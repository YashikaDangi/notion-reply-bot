import { Router, Request, Response } from "express";
import {
  fetchUnrepliedComments,
  updateNotionWithReplies,
} from "../services/notion-service";
import { generateReplyWithDeepSeek } from "../services/deepseek-service";

export const processUnrepliedRoute = Router();

processUnrepliedRoute.post("/", async (req: Request, res: Response) => {
  try {
    // Get request parameters with defaults
    const { 
      batchSize = 10,       // Number of comments per batch
      maxBatches = Infinity // Maximum number of batches to process (default: all)
    } = req.body;
    
    // Calculate how many comments to fetch based on batchSize and maxBatches
    const maxLimit = maxBatches !== Infinity ? batchSize * maxBatches : 1000;

    // Fetch unreplied comments from Notion (now with pagination)
    const unrepliedComments = await fetchUnrepliedComments(maxLimit);

    console.log(`Found ${unrepliedComments.length} unreplied comments`);

    if (unrepliedComments.length === 0) {
      return res.status(404).json({
        message: "No unreplied comments found in Notion",
        hint: "Check that your Reply column exists and that some entries have empty replies",
      });
    }

    // Process comments in batches of the specified size
    const totalBatchesAvailable = Math.ceil(unrepliedComments.length / batchSize);
    // Limit the number of batches to process based on maxBatches
    const batchesToProcess = Math.min(totalBatchesAvailable, maxBatches);
    
    console.log(`Processing ${unrepliedComments.length} comments in ${batchesToProcess} batches of ${batchSize} (${totalBatchesAvailable} batches available)`);
    
    const allProcessedReplies = [];
    const allNotionUpdateResults = [];
    
    // Process each batch
    for (let batchIndex = 0; batchIndex < batchesToProcess; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min((batchIndex + 1) * batchSize, unrepliedComments.length);
      const currentBatch = unrepliedComments.slice(startIndex, endIndex);
      
      console.log(`Processing batch ${batchIndex + 1}/${batchesToProcess} with ${currentBatch.length} comments`);
      
      // Generate replies for this batch using DeepSeek
      const batchProcessedReplies = [];

      for (const comment of currentBatch) {
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

      if (batchProcessedReplies.length === 0) {
        console.warn(`Batch ${batchIndex + 1} failed to generate any replies with DeepSeek AI`);
        continue; // Skip to the next batch instead of failing the whole process
      }

      // Update Notion entries with the generated replies for this batch
      try {
        const batchNotionUpdateResults = await updateNotionWithReplies(batchProcessedReplies);
        
        // Add this batch's results to our overall results
        allProcessedReplies.push(...batchProcessedReplies);
        allNotionUpdateResults.push(...batchNotionUpdateResults);
        
        console.log(`Successfully updated ${batchProcessedReplies.length} Notion entries in batch ${batchIndex + 1}`);
      } catch (error: any) {
        console.error(`Error updating Notion for batch ${batchIndex + 1}:`, error);
      }
    }

    if (allProcessedReplies.length === 0) {
      return res.status(500).json({
        error: "Failed to generate any replies with DeepSeek AI across all batches",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        totalFound: unrepliedComments.length,
        totalProcessed: allProcessedReplies.length,
        batchSize,
        batchesProcessed: batchesToProcess,
        totalBatchesAvailable,
        skippedBatches: totalBatchesAvailable - batchesToProcess,
        replies: allProcessedReplies.map((reply) => ({
          username: reply.username,
          comment: reply.originalComment.substring(0, 50) + (reply.originalComment.length > 50 ? '...' : ''), // Truncated for readability
          generatedReply: reply.generatedReply.substring(0, 50) + (reply.generatedReply.length > 50 ? '...' : ''), // Truncated for readability
        })),
        notionUpdateResults: allNotionUpdateResults,
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