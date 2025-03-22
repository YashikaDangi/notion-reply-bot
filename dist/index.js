"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Error handling middleware to provide detailed Notion field information
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const process_unreplied_route_1 = require("./routes/process-unreplied-route");
// Load environment variables
dotenv_1.default.config();
// Initialize Express app
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Initialize routes
app.use("/process-unreplied", process_unreplied_route_1.processUnrepliedRoute);
// Error handling middleware
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    // Check if it's a Notion API error related to missing fields
    if (err.message &&
        (err.message.includes("Could not find property") ||
            err.message.includes("Invalid property"))) {
        return res.status(400).json({
            error: "Notion database structure error",
            details: err.message,
            help: "Please check that your Notion database has the required fields.",
        });
    }
    // Default error response
    res.status(500).json({
        error: "An unexpected error occurred",
        details: err.message || "Unknown error",
    });
});
// Default route
app.get("/", (req, res) => {
    res.send("Comment Reply Generator API - Using Gemini AI and Notion");
});
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Display environment configuration status
    console.log("\nEnvironment Configuration:");
    console.log(`- Gemini API: ${process.env.GEMINI_API_KEY ? "✅ Configured" : "❌ Not configured"}`);
    console.log(`- Notion API: ${process.env.NOTION_API_KEY && process.env.NOTION_DATABASE_ID
        ? "✅ Configured"
        : "❌ Not configured or incomplete"}`);
    console.log("\nAvailable API Endpoints:");
    console.log("- POST /process-unreplied: Fetch unreplied comments from Notion, generate replies with Gemini, and update Notion");
});
