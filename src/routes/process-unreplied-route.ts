import { Router, Request, Response } from "express";
import {
  fetchUnrepliedComments,
  updateNotionWithReplies,
} from "../services/notion-service";
import { generateReplyWithDeepSeek } from "../services/deepseek-service";

export const processUnrepliedRoute = Router();

processUnrepliedRoute.post("/", async (req: Request, res: Response) => {
  try {
    // Get limit parameter with default of 10
    const { limit = 5 } = req.body;
    
    // Fetch exactly the number of unreplied comments from Notion as specified by limit
    const unrepliedComments = await fetchUnrepliedComments(limit);

    console.log(`Found ${unrepliedComments.length} unreplied comments`);

    if (unrepliedComments.length === 0) {
      return res.status(404).json({
        message: "No unreplied comments found in Notion",
        hint: "Check that your Reply column exists and that some entries have empty replies",
      });
    }

    // Generate replies using DeepSeek
    const processedReplies = [];

    for (const comment of unrepliedComments) {
      try {
        // Generate reply with DeepSeek
        const generatedReply = await generateReplyWithDeepSeek(
          comment.comment,
          comment.username
        );

        processedReplies.push({
          pageId: comment.pageId,
          username: comment.username,
          originalComment: comment.comment,
          generatedReply,
          account: comment.account,
          createdTime: comment.createdTime,
        });

        console.log(`Successfully generated reply for ${comment.username}`);
      } catch (error: any) {
        console.error(`Error generating reply for ${comment.username}:`, error);
        // We don't add failed replies here as we can't update Notion with them
      }
    }

    if (processedReplies.length === 0) {
      return res.status(500).json({
        error: "Failed to generate any replies with DeepSeek AI",
      });
    }

    // Update Notion entries with the generated replies
    const notionUpdateResults = await updateNotionWithReplies(processedReplies);

    return res.status(200).json({
      success: true,
      data: {
        totalFound: unrepliedComments.length,
        totalProcessed: processedReplies.length,
        requestedLimit: limit,
        replies: processedReplies.map((reply) => ({
          username: reply.username,
          comment: reply.originalComment.substring(0, 50) + (reply.originalComment.length > 50 ? '...' : ''), // Truncated for readability
          generatedReply: reply.generatedReply.substring(0, 50) + (reply.generatedReply.length > 50 ? '...' : ''), // Truncated for readability
        })),
        notionUpdateResults: notionUpdateResults,
      },
    });
  } catch (error: any) {
    console.error("Error in process-unreplied route:", error);
    return res.status(500).json({
      error: "Failed to process request",
      details: error.message,
    });
  }
});