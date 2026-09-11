import "dotenv/config";

// Tests never hit the Anthropic or OpenAI APIs. Blank the keys so any accidental
// live call fails loudly instead of silently spending money.
process.env.ANTHROPIC_API_KEY = "";
process.env.OPENAI_API_KEY = "";
