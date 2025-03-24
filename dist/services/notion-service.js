"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUnrepliedComments = fetchUnrepliedComments;
exports.updateNotionWithReplies = updateNotionWithReplies;
const notion_oauth_service_1 = require("./notion-oauth-service");
// Fetch unreplied comments from Notion
async function fetchUnrepliedComments(limit = 50) {
    try {
        const databaseId = process.env.NOTION_DATABASE_ID;
        if (!databaseId) {
            throw new Error("Notion database ID not configured");
        }
        // Get authenticated Notion client through OAuth
        const notion = await (0, notion_oauth_service_1.createNotionClient)();
        // First, get the database to understand its structure
        console.log("Retrieving database structure...");
        const database = await notion.databases.retrieve({
            database_id: databaseId,
        });
        // Identify field names in the database
        const properties = database.properties;
        const propertyNames = Object.keys(properties);
        console.log("Available fields in database:", propertyNames);
        // Find the reply field name (with trimming to handle extra spaces)
        let replyFieldName = null;
        // First, check for exact matches with our common names
        for (const name of propertyNames) {
            const trimmedName = name.trim();
            if (trimmedName === "Reply" ||
                trimmedName === "reply" ||
                trimmedName === "Generated Reply" ||
                trimmedName === "Responded" ||
                trimmedName === "Response") {
                replyFieldName = name; // Use the original name with possible spaces
                console.log(`Found reply field with exact match: "${replyFieldName}"`);
                break;
            }
        }
        // If no exact match, try a more flexible approach
        if (!replyFieldName) {
            for (const name of propertyNames) {
                if (name.toLowerCase().includes("reply") ||
                    name.toLowerCase().includes("response") ||
                    name.toLowerCase().includes("responded")) {
                    replyFieldName = name;
                    console.log(`Found reply field with flexible match: "${replyFieldName}"`);
                    break;
                }
            }
        }
        if (!replyFieldName) {
            console.warn("No recognized reply field found in database. Using fallback logic.");
            // If we still can't find the field, just pick the one that looks most likely
            for (const name of propertyNames) {
                if (name !== "Username" &&
                    name !== "Comment" &&
                    name !== "Account" &&
                    name !== "Created time") {
                    replyFieldName = name;
                    console.log(`Using fallback reply field: "${replyFieldName}"`);
                    break;
                }
            }
        }
        // Query all records first
        console.log("Querying Notion for all comments...");
        const queryOptions = {
            database_id: databaseId,
            page_size: limit,
        };
        const response = await notion.databases.query(queryOptions);
        console.log(`Retrieved ${response.results.length} total comments from Notion`);
        // We'll manually filter for unreplied comments
        const unrepliedComments = [];
        for (const page of response.results) {
            try {
                // Cast page to any to access its properties
                const pageAny = page;
                const pageProperties = pageAny.properties;
                // For debug
                console.log(`Page ID: ${page.id}`);
                console.log(`Property names: ${Object.keys(pageProperties).join(", ")}`);
                // Check if the reply field exists and is empty
                let needsReply = false;
                if (replyFieldName && pageProperties[replyFieldName]) {
                    const replyProperty = pageProperties[replyFieldName];
                    console.log(`Reply field type: ${replyProperty.type}`);
                    if (replyProperty.type === "rich_text") {
                        // Consider it unreplied if the rich_text array is empty or undefined
                        needsReply =
                            !replyProperty.rich_text || replyProperty.rich_text.length === 0;
                        console.log(`Rich text array length: ${replyProperty.rich_text ? replyProperty.rich_text.length : 0}`);
                    }
                    else if (replyProperty.type === "title") {
                        // Consider it unreplied if the title array is empty or undefined
                        needsReply =
                            !replyProperty.title || replyProperty.title.length === 0;
                    }
                    else {
                        // For other field types, check if the value exists
                        needsReply = !replyProperty[replyProperty.type];
                    }
                }
                else {
                    // If we can't find the reply field, assume it needs a reply
                    needsReply = true;
                    console.log(`Reply field not found in page properties`);
                }
                console.log(`Needs reply: ${needsReply}`);
                if (!needsReply) {
                    continue; // Skip this comment as it already has a reply
                }
                // Now extract the comment data
                let commentText = "";
                let username = "";
                let account = "";
                let createdTime = "";
                // Try to find the comment text
                if (pageProperties["Comment"] && pageProperties["Comment"].rich_text) {
                    const richText = pageProperties["Comment"].rich_text;
                    if (richText.length > 0) {
                        commentText = richText[0].plain_text;
                    }
                }
                // No comment text found, try other field names
                if (!commentText) {
                    for (const key of Object.keys(pageProperties)) {
                        if (key !== replyFieldName &&
                            pageProperties[key].type === "rich_text") {
                            const richText = pageProperties[key].rich_text;
                            if (richText && richText.length > 0) {
                                commentText = richText[0].plain_text;
                                console.log(`Found comment text in field: ${key}`);
                                break;
                            }
                        }
                    }
                }
                // Try to find username
                if (pageProperties["Username"] &&
                    pageProperties["Username"].rich_text) {
                    const richText = pageProperties["Username"].rich_text;
                    if (richText.length > 0) {
                        username = richText[0].plain_text;
                    }
                }
                // Try to find account
                if (pageProperties["Account"] && pageProperties["Account"].rich_text) {
                    const richText = pageProperties["Account"].rich_text;
                    if (richText.length > 0) {
                        account = richText[0].plain_text;
                    }
                }
                // Try to find created time
                if (pageProperties["Created time"] &&
                    pageProperties["Created time"].date) {
                    createdTime = pageProperties["Created time"].date.start;
                }
                // If we still don't have enough info, skip this entry
                if (!commentText) {
                    console.log(`Skipping page ${page.id}: no comment text found`);
                    continue;
                }
                // If no username, use a placeholder
                if (!username) {
                    username = "user_" + Math.floor(Math.random() * 1000);
                }
                // Add to our list of unreplied comments
                unrepliedComments.push({
                    pageId: page.id,
                    comment: commentText,
                    username,
                    account,
                    createdTime,
                });
            }
            catch (error) {
                console.error("Error processing page:", error);
                // Continue with next page
            }
        }
        return unrepliedComments;
    }
    catch (error) {
        console.error("Error in fetchUnrepliedComments:", error);
        throw new Error(`Failed to fetch unreplied comments from Notion: ${error.message}`);
    }
}
// Update Notion entries with generated replies
async function updateNotionWithReplies(replies) {
    try {
        const databaseId = process.env.NOTION_DATABASE_ID;
        if (!databaseId) {
            throw new Error("Notion database ID not configured");
        }
        // Get authenticated Notion client
        console.log("Initializing Notion client for updates...");
        const notion = await (0, notion_oauth_service_1.createNotionClient)();
        // First, get the database to understand its structure
        const database = await notion.databases.retrieve({
            database_id: databaseId,
        });
        // Identify the reply field name
        const properties = database.properties;
        const propertyNames = Object.keys(properties);
        console.log("Available fields in database:", propertyNames.join(", "));
        // Find the reply field (with trimming to handle extra spaces)
        let replyFieldName = null;
        // First try exact matches
        for (const name of propertyNames) {
            const trimmedName = name.trim();
            if (trimmedName === "Reply" ||
                trimmedName === "reply" ||
                trimmedName === "Generated Reply" ||
                trimmedName === "Responded" ||
                trimmedName === "Response") {
                replyFieldName = name; // Use the original name with possible spaces
                console.log(`Found reply field with exact match: "${replyFieldName}"`);
                break;
            }
        }
        // If no exact match, try a more flexible approach
        if (!replyFieldName) {
            for (const name of propertyNames) {
                if (name.toLowerCase().includes("reply") ||
                    name.toLowerCase().includes("response") ||
                    name.toLowerCase().includes("responded")) {
                    replyFieldName = name;
                    console.log(`Found reply field with flexible match: "${replyFieldName}"`);
                    break;
                }
            }
        }
        // Last resort - explicitly check for " Reply" with a space
        if (!replyFieldName) {
            for (const name of propertyNames) {
                if (name === " Reply" || name === " reply") {
                    replyFieldName = name;
                    console.log(`Found reply field with leading space: "${replyFieldName}"`);
                    break;
                }
            }
        }
        if (!replyFieldName) {
            throw new Error(`Could not find a reply field in the database. Available fields: ${propertyNames.join(", ")}`);
        }
        console.log(`Using reply field: "${replyFieldName}"`);
        // Get the type of the reply field to handle it correctly
        const replyFieldType = properties[replyFieldName].type;
        console.log(`Reply field type: ${replyFieldType}`);
        const results = [];
        // Update each Notion page with the generated reply
        for (const reply of replies) {
            try {
                console.log(`Updating Notion entry for comment by ${reply.username}...`);
                // Create the properties object based on field type
                const updateProperties = {};
                if (replyFieldType === "rich_text") {
                    updateProperties[replyFieldName] = {
                        rich_text: [
                            {
                                text: {
                                    content: reply.generatedReply && reply.generatedReply.length > 2000
                                        ? reply.generatedReply.substring(0, 1997) + "..."
                                        : reply.generatedReply || "",
                                },
                            },
                        ],
                    };
                }
                else if (replyFieldType === "title") {
                    updateProperties[replyFieldName] = {
                        title: [
                            {
                                text: {
                                    content: reply.generatedReply && reply.generatedReply.length > 2000
                                        ? reply.generatedReply.substring(0, 1997) + "..."
                                        : reply.generatedReply || "",
                                },
                            },
                        ],
                    };
                }
                else {
                    throw new Error(`Unsupported field type for replies: ${replyFieldType}`);
                }
                // Update the page with the generated reply
                await notion.pages.update({
                    page_id: reply.pageId,
                    properties: updateProperties,
                });
                results.push({
                    username: reply.username,
                    notionPageId: reply.pageId,
                    success: true,
                });
                console.log(`Successfully updated Notion entry for ${reply.username}`);
            }
            catch (error) {
                console.error(`Error updating Notion entry for ${reply.username}:`, error);
                results.push({
                    username: reply.username,
                    success: false,
                    error: error.message || "Unknown error",
                });
            }
        }
        return results;
    }
    catch (error) {
        console.error("Error in updateNotionWithReplies:", error);
        throw new Error(`Failed to update Notion entries with replies: ${error.message}`);
    }
}
