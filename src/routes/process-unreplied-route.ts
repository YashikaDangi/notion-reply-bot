import { Router, Request, Response } from "express";
import {
  fetchUnrepliedComments,
  updateNotionWithReplies,
} from "../services/notion-service";
import { generateReplyWithGemini } from "../services/gemini-service";

export const processUnrepliedRoute = Router();

/**
 * Route to fetch unreplied comments from Notion, generate replies using Gemini,
 * and update the Notion database with the generated replies
 *
 * Request body:
 * {
 *   limit?: number        // Optional limit on number of comments to process (default: 10)
 * }
 */
processUnrepliedRoute.post("/", async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.body;

    // Fetch unreplied comments from Notion
    const unrepliedComments = await fetchUnrepliedComments(limit);

    console.log(`Found ${unrepliedComments.length} unreplied comments`);

    if (unrepliedComments.length === 0) {
      return res.status(404).json({
        message: "No unreplied comments found in Notion",
        hint: "Check that your Reply column exists and that some entries have empty replies",
      });
    }

    // Generate replies using Gemini
    const processedReplies = [];

    for (const comment of unrepliedComments) {
      try {
        // Generate reply with Gemini
        const generatedReply = await generateReplyWithGemini(
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
        error: "Failed to generate any replies with Gemini AI",
      });
    }

    // Update Notion entries with the generated replies
    const notionUpdateResults = await updateNotionWithReplies(processedReplies);

    // Return the results
    return res.status(200).json({
      success: true,
      data: {
        totalFound: unrepliedComments.length,
        processed: processedReplies.length,
        replies: processedReplies.map((reply) => ({
          username: reply.username,
          comment: reply.originalComment,
          generatedReply: reply.generatedReply,
        })),
        notionUpdateResults,
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
