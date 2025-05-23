"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processUnrepliedRoute = void 0;
const express_1 = require("express");
const notion_service_1 = require("../services/notion-service");
const deepseek_service_1 = require("../services/deepseek-service");
exports.processUnrepliedRoute = (0, express_1.Router)();
exports.processUnrepliedRoute.post("/", async (req, res) => {
    try {
        const { limit = 10 } = req.body;
        // Fetch unreplied comments from Notion
        const unrepliedComments = await (0, notion_service_1.fetchUnrepliedComments)(limit);
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
                const generatedReply = await (0, deepseek_service_1.generateReplyWithDeepSeek)(comment.comment, comment.username);
                processedReplies.push({
                    pageId: comment.pageId,
                    username: comment.username,
                    originalComment: comment.comment,
                    generatedReply,
                    account: comment.account,
                    createdTime: comment.createdTime,
                });
                console.log(`Successfully generated reply for ${comment.username}`);
            }
            catch (error) {
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
        const notionUpdateResults = await (0, notion_service_1.updateNotionWithReplies)(processedReplies);
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
                // Comment out the notionUpdateResults in the response too
                notionUpdateResults,
            },
        });
    }
    catch (error) {
        console.error("Error in process-unreplied route:", error);
        return res.status(500).json({
            error: "Failed to process request",
            details: error.message,
        });
    }
});
