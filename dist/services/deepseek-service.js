"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReplyWithDeepSeek = generateReplyWithDeepSeek;
const openai_1 = __importDefault(require("openai"));
async function generateReplyWithDeepSeek(comment, username) {
    try {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            throw new Error("DeepSeek API key is not configured");
        }
        // Initialize the OpenAI client with DeepSeek's baseURL
        const openai = new openai_1.default({
            baseURL: "https://api.deepseek.com",
            apiKey: apiKey,
        });
        const systemMessage = `You reply to Instagram comments about movies/TV/songs. Follow these rules:
Statements → Playful agreement (e.g., 'Right?! That scene blew my mind too! 🚀').
Questions → Friendly answer (keep it short).
All emojis → Reply with 3 relevant emojis.
Contains '@' → ❤️🧡💛 only.
Unclear context → 3 relevant emojis.
Always be warm and mildly humorous. Output text only, no quotes.`;
        const userMessage = `Comment to reply to: ${comment}`;
        const completion = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: userMessage },
            ],
            max_tokens: 512,
            temperature: 1.0,
        });
        // Extract the reply content
        const reply = completion.choices[0]?.message.content?.trim() || "";
        return reply;
    }
    catch (error) {
        console.error("Error generating reply with DeepSeek:", error);
        // Get the error message from the error object
        const errorMessage = error.message ||
            error.response?.data?.error?.message ||
            "Unknown error occurred";
        // Return a fallback response instead of throwing an error
        console.log(`Returning fallback response due to error: ${errorMessage}`);
        return "Thanks for your comment! 👍";
    }
}
