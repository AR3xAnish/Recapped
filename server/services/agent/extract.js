const { ChatGroq } = require("@langchain/groq");
const { JsonOutputParser } = require("@langchain/core/output_parsers");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { z } = require("zod");

// Zod Schema to validate model outputs
const ExtractionSchema = z.object({
  participants: z.array(
    z.object({
      name: z.string().describe("The name of the participant. E.g. 'Alice Smith'"),
      role: z.string().optional().default("").describe("The role or department of this participant, if mentioned"),
    })
  ).default([]),
  actionItems: z.array(
    z.object({
      description: z.string().describe("Clear and actionable description of the task or commitment"),
      owner: z.string().describe("The name of the participant responsible for this action item, or 'Unassigned'"),
      deadline: z.string().optional().default("").describe("The deadline, date, or relative time if mentioned"),
      confidence: z.enum(["high", "medium", "low"]).describe("Extraction confidence level based on commitment explicitness"),
    })
  ).default([]),
  keyDecisions: z.array(
    z.string().describe("A key decision made during the meeting")
  ).default([]),
});

const schemaInstructions = `
You must return a valid JSON object matching this schema exactly:
{
  "participants": [
    { "name": "string (required)", "role": "string (optional)" }
  ],
  "actionItems": [
    {
      "description": "string (required)",
      "owner": "string (required, name of participant or 'Unassigned')",
      "deadline": "string (optional)",
      "confidence": "string (required, must be 'high', 'medium', or 'low')"
    }
  ],
  "keyDecisions": [
    "string"
  ]
}
Ensure there is NO markdown wrapper (like \`\`\`json), NO backticks, and NO conversational text. Output ONLY raw JSON.
`;

// Helper to split transcript into manageable chunks (by words)
const chunkText = (text, maxWords = 5000) => {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }
  return chunks;
};

// Re-prompt model if JSON syntax parsing fails
const repairJsonSyntax = async (originalText, parseError, retryCount) => {
  const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    temperature: 0,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are an expert AI meeting scribe. The JSON you returned previously is syntactically invalid (malformed). You must fix it. Output ONLY raw, valid JSON matching the schema, no markdown wrappers, no backticks, no conversational text.\n{schema_instructions}"],
    ["human", "Original Transcript:\n{text}\n\nParsing Error:\n{error}\n\nPlease generate valid, syntactically correct JSON."]
  ]);

  const chain = prompt.pipe(model).pipe(new JsonOutputParser());

  try {
    const rawResult = await chain.invoke({
      text: originalText,
      error: parseError.message,
      schema_instructions: schemaInstructions
    });
    return ExtractionSchema.parse(rawResult);
  } catch (err) {
    console.error(`[Repair Syntax] Attempt ${retryCount} failed:`, err.message);
    if (retryCount < 2) {
      if (err.name === "ZodError") {
        return repairZodValidation(originalText, err.output || {}, err, retryCount + 1);
      }
      return repairJsonSyntax(originalText, err, retryCount + 1);
    }
    throw err;
  }
};

// Re-prompt model if Zod schema validation fails
const repairZodValidation = async (originalText, invalidJson, zodError, retryCount) => {
  const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    temperature: 0,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are an expert AI meeting scribe. The JSON you generated previously contains schema validation errors. You must correct the errors. Output ONLY the raw corrected JSON matching the schema, no markdown wrappers, no backticks, no conversational text.\n{schema_instructions}"],
    ["human", "Original Transcript:\n{text}\n\nInvalid JSON:\n{invalid_json}\n\nValidation Errors:\n{error}\n\nPlease correct the JSON output."]
  ]);

  const chain = prompt.pipe(model).pipe(new JsonOutputParser());

  try {
    const rawResult = await chain.invoke({
      text: originalText,
      invalid_json: JSON.stringify(invalidJson, null, 2),
      error: zodError.message,
      schema_instructions: schemaInstructions
    });
    return ExtractionSchema.parse(rawResult);
  } catch (err) {
    console.error(`[Repair Zod] Attempt ${retryCount} failed:`, err.message);
    if (retryCount < 2) {
      if (err.name === "ZodError") {
        return repairZodValidation(originalText, invalidJson, err, retryCount + 1);
      }
      return repairJsonSyntax(originalText, err, retryCount + 1);
    }
    throw err;
  }
};

// Core extraction for a single transcript chunk
const extractFromChunk = async (text, retryCount = 0) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY environment variable is not defined.");
  }

  const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    temperature: 0,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are an expert AI meeting scribe. Your job is to analyze the meeting transcript and extract structured information. You must strictly follow these formatting guidelines:\n{schema_instructions}"],
    ["human", "Meeting Transcript:\n{text}"]
  ]);

  const chain = prompt.pipe(model).pipe(new JsonOutputParser());

  let rawResult;
  try {
    rawResult = await chain.invoke({ text, schema_instructions: schemaInstructions });
  } catch (parseError) {
    console.warn(`[Extraction] JSON parsing failed on first attempt:`, parseError.message);
    if (retryCount < 2) {
      return await repairJsonSyntax(text, parseError, retryCount + 1);
    }
    throw parseError;
  }

  try {
    return ExtractionSchema.parse(rawResult);
  } catch (zodError) {
    console.warn(`[Extraction] Schema validation failed on first attempt:`, zodError.message);
    if (retryCount < 2) {
      return await repairZodValidation(text, rawResult, zodError, retryCount + 1);
    }
    throw zodError;
  }
};

// Merge and deduplicate extractions across multiple chunks
const mergeExtractions = (extractions) => {
  const merged = {
    participants: [],
    actionItems: [],
    keyDecisions: [],
  };

  const participantMap = new Map();
  const actionItemMap = new Map();
  const decisionsSet = new Set();

  extractions.forEach((ext) => {
    // 1. Merge participants
    if (ext.participants) {
      ext.participants.forEach((p) => {
        if (!p.name) return;
        const name = p.name.trim();
        const key = name.toLowerCase();
        if (participantMap.has(key)) {
          const existing = participantMap.get(key);
          // If existing does not have a role, update it with new role
          if (!existing.role && p.role) {
            existing.role = p.role.trim();
          }
        } else {
          participantMap.set(key, {
            name,
            role: p.role ? p.role.trim() : "",
          });
        }
      });
    }

    // 2. Merge action items
    if (ext.actionItems) {
      ext.actionItems.forEach((item) => {
        if (!item.description) return;
        const desc = item.description.trim();
        const key = desc.toLowerCase();
        if (!actionItemMap.has(key)) {
          actionItemMap.set(key, {
            description: desc,
            owner: item.owner ? item.owner.trim() : "Unassigned",
            deadline: item.deadline ? item.deadline.trim() : "",
            confidence: item.confidence || "medium",
          });
        }
      });
    }

    // 3. Merge key decisions
    if (ext.keyDecisions) {
      ext.keyDecisions.forEach((dec) => {
        if (!dec) return;
        const clean = dec.trim();
        const key = clean.toLowerCase();
        if (!decisionsSet.has(key)) {
          decisionsSet.add(key);
          merged.keyDecisions.push(clean);
        }
      });
    }
  });

  merged.participants = Array.from(participantMap.values());
  merged.actionItems = Array.from(actionItemMap.values());

  return merged;
};

// Main entry point for processing a transcript (handles chunking)
const extractTranscript = async (rawTranscript) => {
  if (!rawTranscript || !rawTranscript.trim()) {
    throw new Error("Transcript content is empty.");
  }

  // Chunk every 5000 words to be safe
  const chunks = chunkText(rawTranscript, 5000);
  const extractions = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`[Agent] Processing transcript chunk ${i + 1} of ${chunks.length}...`);
    const chunkExtraction = await extractFromChunk(chunks[i]);
    extractions.push(chunkExtraction);
  }

  return mergeExtractions(extractions);
};

module.exports = {
  extractTranscript,
};
