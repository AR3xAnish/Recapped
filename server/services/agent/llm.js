const { ChatGroq } = require("@langchain/groq");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");

/**
 * Model factory helper returning either a Groq or Gemini LangChain chat model.
 *
 * @function getLLM
 * @param {number} [temperature=0.1] - Controls the randomness of the model's responses.
 * @returns {ChatGroq|ChatGoogleGenerativeAI} An initialized, provider-specific model instance.
 */
function getLLM(temperature = 0.1) {
  const provider = (process.env.AI_PROVIDER || "groq").toLowerCase();

  if (provider === "gemini") {
    const rawKey = process.env.GEMINI_API_KEY;
    if (!rawKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is not defined but AI_PROVIDER is set to 'gemini'."
      );
    }
    const apiKey = rawKey.replace(/^["']|["']$/g, "");
    const modelName = process.env.GEMINI_MODEL || "gemini-3-flash";
    return new ChatGoogleGenerativeAI({
      apiKey,
      model: modelName,
      temperature,
    });
  } else {
    // Default to Groq
    const rawKey = process.env.GROQ_API_KEY;
    if (!rawKey) {
      throw new Error(
        "GROQ_API_KEY environment variable is not defined but AI_PROVIDER is set to 'groq'."
      );
    }
    const apiKey = rawKey.replace(/^["']|["']$/g, "");
    return new ChatGroq({
      apiKey,
      model: "llama-3.3-70b-versatile",
      temperature,
    });
  }
}

module.exports = {
  getLLM,
};
