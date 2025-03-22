"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReplyWithGemini = generateReplyWithGemini;
const axios_1 = __importDefault(require("axios"));
async function generateReplyWithGemini(comment, username) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("Gemini API key is not configured");
        }
        // console.log(`Generating reply for comment by ${username}: "${comment}"`);
        const messages = [
            {
                role: "user",
                parts: [
                    {
                        text: `You are a helpful assistant that generates friendly, personalized responses to comments. If you see that the comment includes a heart emoji (❤️) or mentions anything like "loving this" or "so good", respond with appreciation. Include 1-3 appropriate emojis at the end of your response (hearts, fire, etc.). Keep your response brief and conversational. Generate a reply to this comment from ${username}: "${comment}"`,
                    },
                ],
            },
        ];
        const requestBody = {
            contents: messages,
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 150,
                topP: 0.95,
                topK: 40,
            },
        };
        // Use the working gemini-1.5-pro model directly
        const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
        const response = await axios_1.default.post(apiUrl, requestBody, {
            headers: {
                "Content-Type": "application/json",
            },
        });
        if (!response.data.candidates || response.data.candidates.length === 0) {
            console.error("No candidates returned from Gemini API:", response.data);
            return "Thanks for sharing your thoughts! 👍"; // Fallback response
        }
        const reply = response.data.candidates[0]?.content?.parts[0]?.text?.trim() || "";
        // console.log(`Successfully generated reply: "${reply}"`);
        return reply;
    }
    catch (error) {
        console.error("Error generating reply with Gemini:", error);
        // Get the error message from the error object
        const errorMessage = error.message ||
            error.response?.data?.error?.message ||
            "Unknown error occurred";
        // Return a fallback response instead of throwing an error
        console.log(`Returning fallback response due to error: ${errorMessage}`);
        return "Thanks for your comment! 👍";
    }
}
