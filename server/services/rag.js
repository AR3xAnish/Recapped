const mongoose = require("mongoose");
const Meeting = require("../models/Meeting");
const TranscriptChunk = require("../models/TranscriptChunk");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { ChatGroq } = require("@langchain/groq");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { pipeline } = require("@xenova/transformers");

let extractor = null;

async function getExtractor() {
  if (!extractor) {
    console.log("[RAG] Loading Xenova/all-MiniLM-L6-v2 embedding model...");
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("[RAG] Model loaded successfully.");
  }
  return extractor;
}

async function getEmbedding(text) {
  const model = await getExtractor();
  const output = await model(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data);
}

async function indexMeeting(meetingId, rawTranscript) {
  if (!rawTranscript || rawTranscript.trim() === "") {
    console.warn(`[RAG] No transcript to index for meeting ${meetingId}.`);
    return false;
  }

  console.log(`[RAG] Beginning indexing for meeting ${meetingId}...`);

  // 1. Delete previous chunks for this meeting to prevent duplicates on retry
  await TranscriptChunk.deleteMany({ meetingId });

  // 2. Split transcript into chunks (~500 tokens = ~2000 chars, ~75 token overlap = ~300 chars)
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 2000,
    chunkOverlap: 300,
  });
  const chunkTexts = await splitter.splitText(rawTranscript);
  console.log(`[RAG] Split transcript into ${chunkTexts.length} chunks.`);

  // 3. Generate embeddings and save chunks
  const insertDocs = [];
  for (let i = 0; i < chunkTexts.length; i++) {
    const chunkText = chunkTexts[i];
    const embedding = await getEmbedding(chunkText);
    insertDocs.push({
      meetingId,
      chunkText,
      embedding,
      chunkIndex: i,
    });
  }

  if (insertDocs.length > 0) {
    await TranscriptChunk.insertMany(insertDocs);
  }

  // 4. Update chunked flag in Meeting document
  await Meeting.findByIdAndUpdate(meetingId, { chunked: true });
  console.log(`[RAG] Indexing completed successfully for meeting ${meetingId}.`);
  return true;
}

async function askMeetingQuestion(meetingId, question) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY environment variable is not configured on the server.");
  }

  // 1. Embed the query question
  console.log(`[RAG] Embedding question for meeting ${meetingId}: "${question}"`);
  const queryEmbedding = await getEmbedding(question);

  // 2. Query MongoDB Vector Search with filter isolation on meetingId
  console.log(`[RAG] Executing $vectorSearch on meeting ${meetingId}...`);
  const retrievedChunks = await TranscriptChunk.aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: 5,
        filter: {
          meetingId: {
            $eq: new mongoose.Types.ObjectId(meetingId),
          },
        },
      },
    },
  ]);

  if (retrievedChunks.length === 0) {
    console.log(`[RAG] No chunks found for meeting ${meetingId} matching the query.`);
    return {
      answer: "I don't see that mentioned in this meeting.",
      sources: [],
    };
  }

  console.log(`[RAG] Retrieved ${retrievedChunks.length} matching context chunks.`);

  // 3. Format context excerpts
  const context = retrievedChunks
    .map((c) => `Excerpt [Index: ${c.chunkIndex}]:\n${c.chunkText}`)
    .join("\n\n");

  // 4. Build LangChain RetrievalQA-style chain and call Groq
  const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    temperature: 0,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are an expert meeting assistant. You are answering a question about a meeting. You must answer the question based ONLY on the provided excerpts from the meeting transcript. Do not use any outside knowledge. If the excerpts do not contain enough information to support an answer, respond with exactly: \"I don't see that mentioned in this meeting.\"\n\nExcerpts:\n{context}",
    ],
    ["human", "{question}"],
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.invoke({
    context,
    question,
  });

  const answer = response.content;
  const sources = retrievedChunks.map((c) => ({
    chunkIndex: c.chunkIndex,
    excerpt: c.chunkText,
  }));

  return {
    answer,
    sources,
  };
}

module.exports = {
  indexMeeting,
  askMeetingQuestion,
};
