import { Router, Request, Response } from "express";
import {
  fetchUnrepliedComments,
  updateNotionWithReplies,
} from "../services/notion-service";
import { generateReplyWithDeepSeek } from "../services/deepseek-service";

export const processUnrepliedRoute = Router();

processUnrepliedRoute.post("/", async (req: Request, res: Response) => {
  try {
    const { limit } = req.body;

    // Fetch unreplied comments from Notion - with or without limit
    const unrepliedComments = await fetchUnrepliedComments(limit);

    console.log(`Found ${unrepliedComments.length} unreplied comments`);

    // If we found unreplied comments, generate replies
    if (unrepliedComments.length > 0) {
      console.log(`Processing ${unrepliedComments.length} unreplied comments...`);
      
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
          processed: processedReplies.length,
          replies: processedReplies.map((reply) => ({
            username: reply.username,
            comment: reply.originalComment,
            generatedReply: reply.generatedReply,
          })),
          notionUpdateResults,
        },
      });
    } else {
      return res.status(404).json({
        message: "No unreplied comments found in Notion",
        hint: "Check that your Reply column exists and that some entries have empty replies",
      });
    }
  } catch (error: any) {
    console.error("Error in process-unreplied route:", error);
    return res.status(500).json({
      error: "Failed to process request",
      details: error.message,
    });
  }
});