import { Router, Request, Response } from "express";
import {
  fetchUnrepliedComments,
  updateNotionWithReplies,
} from "../services/notion-service";
import { generateReplyWithDeepSeek } from "../services/deepseek-service";

export const processUnrepliedRoute = Router();

// Batch size for processing comments
const BATCH_SIZE = 25;

processUnrepliedRoute.post("/", async (req: Request, res: Response) => {
  try {
    const { maxBatches } = req.body; // Optional: limit total number of batches
    let totalProcessed = 0;
    let batchesProcessed = 0;
    let hasMoreToProcess = true;
    let lastCursor: string | null = null;
    const allProcessedReplies: any[] = [];

    // Process comments in batches until no more found or max batches reached
    while (hasMoreToProcess && (!maxBatches || batchesProcessed < maxBatches)) {
      console.log(`Processing batch #${batchesProcessed + 1}${lastCursor ? " (with cursor)" : ""}`);
      
      // Fetch a batch of unreplied comments
      const { comments: batchComments, nextCursor } = await fetchUnrepliedComments(BATCH_SIZE, lastCursor);
      
      // Update cursor for next batch
      lastCursor = nextCursor;
      
      // Check if we found any unreplied comments
      if (batchComments.length === 0) {
        console.log("No more unreplied comments found");
        hasMoreToProcess = false;
        break;
      }
      
      console.log(`Found ${batchComments.length} unreplied comments in batch #${batchesProcessed + 1}`);
      
      // Generate replies for this batch
      const batchProcessedReplies = [];
      for (const comment of batchComments) {
        try {
          // Generate reply with DeepSeek
          const generatedReply = await generateReplyWithDeepSeek(
            comment.comment,
            comment.username
          );

          batchProcessedReplies.push({
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

      // Update Notion with replies from this batch
      if (batchProcessedReplies.length > 0) {
        console.log(`Updating Notion with ${batchProcessedReplies.length} replies from batch #${batchesProcessed + 1}`);
        await updateNotionWithReplies(batchProcessedReplies);
        
        // Add processed replies to overall collection
        allProcessedReplies.push(...batchProcessedReplies);
        totalProcessed += batchProcessedReplies.length;
      } else {
        console.log(`No replies were successfully generated in batch #${batchesProcessed + 1}`);
      }
      
      // Increment batch counter
      batchesProcessed++;
      
      // If we received fewer comments than batch size, we've reached the end
      if (batchComments.length < BATCH_SIZE || !nextCursor) {
        hasMoreToProcess = false;
      }
    }

    // Return response with summary of all processed batches
    if (totalProcessed > 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalBatchesProcessed: batchesProcessed,
          totalCommentsProcessed: totalProcessed,
          hasMoreToProcess: hasMoreToProcess,
          nextCursor: lastCursor,
          sampleReplies: allProcessedReplies.slice(0, 5).map((reply) => ({
            username: reply.username,
            comment: reply.originalComment.substring(0, 50) + (reply.originalComment.length > 50 ? "..." : ""),
            generatedReply: reply.generatedReply,
          })),
        },
      });
    } else {
      return res.status(404).json({
        message: "No unreplied comments found or all generation attempts failed",
        batchesChecked: batchesProcessed,
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