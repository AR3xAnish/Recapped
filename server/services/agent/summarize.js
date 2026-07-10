const { ChatGroq } = require("@langchain/groq");
const { JsonOutputParser } = require("@langchain/core/output_parsers");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { z } = require("zod");

// Zod Schema to validate summary and email outputs
const SummarizeSchema = z.object({
  summary: z.string().describe("A 3 to 6 sentence plain-text summary of the meeting, capturing key discussion points"),
  followUpEmail: z.object({
    subject: z.string().describe("Concise and descriptive email subject line recap"),
    body: z.string().describe("Approachable and professional follow-up email text, listing key decisions and action items with owners and deadlines"),
  }),
});

const schemaInstructions = `
You must return a valid JSON object matching this schema exactly:
{
  "summary": "string (3-6 sentence executive summary)",
  "followUpEmail": {
    "subject": "string (email subject recap)",
    "body": "string (complete plain text email body recap listing main points, decisions, and action items with owners/deadlines)"
  }
}
Ensure there is NO markdown wrapper (like \`\`\`json), NO backticks, and NO conversational text. Output ONLY raw JSON.
`;

const generateSummaryAndEmail = async (rawTranscript, participants, actionItems, keyDecisions) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY environment variable is not defined.");
  }

  const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    temperature: 0.3, // Slightly creative but structured
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are an expert AI meeting assistant. Your task is to write a meeting summary and draft a follow-up email based on the transcript and already-extracted meeting elements. Follow this schema:\n{schema_instructions}"],
    ["human", "Meeting Transcript:\n{transcript}\n\nParticipants:\n{participants}\n\nAction Items:\n{action_items}\n\nKey Decisions:\n{decisions}"]
  ]);

  const chain = prompt.pipe(model).pipe(new JsonOutputParser());

  const formattedParticipants = JSON.stringify(participants, null, 2);
  const formattedActionItems = JSON.stringify(actionItems, null, 2);
  const formattedDecisions = JSON.stringify(keyDecisions, null, 2);

  try {
    const rawResult = await chain.invoke({
      transcript: rawTranscript.substring(0, 30000), // Limit transcript characters to avoid context bloating
      participants: formattedParticipants,
      action_items: formattedActionItems,
      decisions: formattedDecisions,
      schema_instructions: schemaInstructions
    });
    return SummarizeSchema.parse(rawResult);
  } catch (err) {
    console.warn(`[Summarize] First attempt failed, attempting repair...`, err.message);
    
    // Repair fallback
    const repairPrompt = ChatPromptTemplate.fromMessages([
      ["system", "You are an expert AI meeting assistant. Your previously generated summary output contains schema validation errors. Correct it. Output ONLY valid raw JSON matching the schema.\n{schema_instructions}"],
      ["human", "Transcript:\n{transcript}\n\nError:\n{error}\n\nPlease correct the JSON output."]
    ]);
    const repairChain = repairPrompt.pipe(model).pipe(new JsonOutputParser());
    
    const rawResult = await repairChain.invoke({
      transcript: rawTranscript.substring(0, 10000),
      error: err.message,
      schema_instructions: schemaInstructions
    });
    return SummarizeSchema.parse(rawResult);
  }
};

module.exports = {
  generateSummaryAndEmail,
};
