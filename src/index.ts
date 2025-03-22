// Error handling middleware to provide detailed Notion field information
import express from "express";
import dotenv from "dotenv";
import { processUnrepliedRoute } from "./routes/process-unreplied-route";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(express.json());

// Initialize routes
app.use("/process-unreplied", processUnrepliedRoute);

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Unhandled error:", err);

  // Check if it's a Notion API error related to missing fields
  if (
    err.message &&
    (err.message.includes("Could not find property") ||
      err.message.includes("Invalid property"))
  ) {
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
  console.log(
    `- Gemini API: ${
      process.env.GEMINI_API_KEY ? "✅ Configured" : "❌ Not configured"
    }`
  );
  console.log(
    `- Notion API: ${
      process.env.NOTION_API_KEY && process.env.NOTION_DATABASE_ID
        ? "✅ Configured"
        : "❌ Not configured or incomplete"
    }`
  );

  console.log("\nAvailable API Endpoints:");
  console.log(
    "- POST /process-unreplied: Fetch unreplied comments from Notion, generate replies with Gemini, and update Notion"
  );
});
