"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Error handling middleware to provide detailed Notion field information
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const process_unreplied_route_1 = require("./routes/process-unreplied-route");
const auth_routes_1 = require("./routes/auth-routes");
// Load environment variables
dotenv_1.default.config();
// Initialize Express app
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Initialize routes
app.use("/auth", auth_routes_1.authRoutes);
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
    // Check for authentication errors
    if (err.message &&
        (err.message.includes("access token expired") ||
            err.message.includes("not authenticated"))) {
        return res.status(401).json({
            error: "Authentication error",
            details: err.message,
            help: "Please authenticate with Notion by visiting the /auth/login endpoint."
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
    res.send("Comment Reply Generator API - Using DeepSeek AI and Notion OAuth");
});
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Display environment configuration status
    console.log("\nEnvironment Configuration:");
    console.log(`- DeepSeek API: ${process.env.DEEPSEEK_API_KEY ? "✅ Configured" : "❌ Not configured"}`);
    const notionOAuthConfigured = process.env.NOTION_CLIENT_ID &&
        process.env.NOTION_CLIENT_SECRET &&
        process.env.NOTION_REDIRECT_URI;
    console.log(`- Notion OAuth: ${notionOAuthConfigured ? "✅ Configured" : "❌ Not configured or incomplete"}`);
    console.log(`- Notion Database ID: ${process.env.NOTION_DATABASE_ID ? "✅ Configured" : "❌ Not configured"}`);
    console.log("\nAvailable API Endpoints:");
    console.log("- GET /auth/login: Initiate Notion OAuth authentication flow");
    console.log("- GET /auth/callback: Notion OAuth callback endpoint");
    console.log("- GET /auth/status: Check authentication status");
    console.log("- POST /process-unreplied: Fetch unreplied comments from Notion, generate replies with DeepSeek, and update Notion");
});
