import { createNotionClient } from "./notion-oauth-service";

interface Reply {
  pageId: string;
  username: string;
  originalComment: string;
  generatedReply: string;
  account?: string;
  createdTime?: string;
}

interface CommentsResult {
  comments: any[];
  nextCursor: string | null;
}

// Fetch unreplied comments from Notion with pagination support
export async function fetchUnrepliedComments(
  batchSize: number = 10,
  startCursor: string | null = null
): Promise<CommentsResult> {
  try {
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!databaseId) {
      throw new Error("Notion database ID not configured");
    }

    // Get authenticated Notion client through OAuth
    const notion = await createNotionClient();

    // First, get the database to understand its structure (only on first batch)
    if (!startCursor) {
      console.log("Retrieving database structure...");
      const database = await notion.databases.retrieve({
        database_id: databaseId,
      });

      // Identify field names in the database
      const properties = (database as any).properties;
      const propertyNames = Object.keys(properties);
      console.log("Available fields in database:", propertyNames);
    }

    // Fetch a batch of comments
    console.log(`Fetching batch of up to ${batchSize} comments${startCursor ? " with cursor" : ""}...`);
    const queryOptions: any = {
      database_id: databaseId,
      page_size: batchSize,
    };

    if (startCursor) {
      queryOptions.start_cursor = startCursor;
    }

    const response = await notion.databases.query(queryOptions);
    
    console.log(`Retrieved ${response.results.length} comments from Notion`);
    
    // Find the reply field name for each page
    const unrepliedComments: any[] = [];
    
    for (const page of response.results) {
      try {
        // Cast page to any to access its properties
        const pageAny = page as any;
        const pageProperties = pageAny.properties;
        
        // Find the reply field name in this page
        let replyFieldName = findReplyFieldName(pageProperties);
        
        // Check if the reply field is empty
        let needsReply = checkIfNeedsReply(pageProperties, replyFieldName);
        
        // Debug info
        console.log(`Page ID: ${page.id}, Needs reply: ${needsReply}`);
        
        // If this comment doesn't need a reply, skip to the next one
        if (!needsReply) {
          continue;
        }
        
        // Extract comment information
        const commentInfo = extractCommentInfo(page.id, pageProperties);
        
        // If we found a valid comment, add it to our list
        if (commentInfo.comment) {
          unrepliedComments.push(commentInfo);
        } else {
          console.log(`Skipping page ${page.id}: no comment text found`);
        }
      } catch (error) {
        console.error("Error processing page:", error);
        // Continue with next page
      }
    }
    
    return {
      comments: unrepliedComments,
      nextCursor: response.has_more ? response.next_cursor : null
    };
  } catch (error: any) {
    console.error("Error in fetchUnrepliedComments:", error);
    throw new Error(
      `Failed to fetch unreplied comments from Notion: ${error.message}`
    );
  }
}

// Helper function to find the reply field name
function findReplyFieldName(properties: any): string | null {
  // First, check for exact matches with our common names
  for (const name of Object.keys(properties)) {
    const trimmedName = name.trim();
    if (
      trimmedName === "Reply" ||
      trimmedName === "reply" ||
      trimmedName === "Generated Reply" ||
      trimmedName === "Responded" ||
      trimmedName === "Response"
    ) {
      // console.log(`Found reply field with exact match: "${name}"`);
      return name;
    }
  }

  // If no exact match, try a more flexible approach
  for (const name of Object.keys(properties)) {
    if (
      name.toLowerCase().includes("reply") ||
      name.toLowerCase().includes("response") ||
      name.toLowerCase().includes("responded")
    ) {
      // console.log(`Found reply field with flexible match: "${name}"`);
      return name;
    }
  }

  // Last check for fields with spaces
  for (const name of Object.keys(properties)) {
    if (name === " Reply" || name === " reply") {
      console.log(`Found reply field with leading space: "${name}"`);
      return name;
    }
  }

  // If we still can't find the field, use a fallback approach
  const propertyNames = Object.keys(properties);
  for (const name of propertyNames) {
    if (
      name !== "Username" &&
      name !== "Comment" &&
      name !== "Account" &&
      name !== "Created time"
    ) {
      console.log(`Using fallback reply field: "${name}"`);
      return name;
    }
  }

  // If we get here, we couldn't find a suitable field
  console.warn("No recognized reply field found in database.");
  return null;
}

// Helper function to check if a comment needs a reply
function checkIfNeedsReply(properties: any, replyFieldName: string | null): boolean {
  if (!replyFieldName) {
    return true; // If we can't find the reply field, assume it needs a reply
  }

  if (!properties[replyFieldName]) {
    return true; // If the field doesn't exist in this record, assume it needs a reply
  }

  const replyProperty = properties[replyFieldName];
  
  if (replyProperty.type === "rich_text") {
    // Consider it unreplied if the rich_text array is empty or undefined
    return !replyProperty.rich_text || replyProperty.rich_text.length === 0;
  } else if (replyProperty.type === "title") {
    // Consider it unreplied if the title array is empty or undefined
    return !replyProperty.title || replyProperty.title.length === 0;
  } else {
    // For other field types, check if the value exists
    return !replyProperty[replyProperty.type];
  }
}

// Helper function to extract comment information from a Notion page
function extractCommentInfo(pageId: string, properties: any): any {
  let commentText = "";
  let username = "";
  let account = "";
  let createdTime = "";

  // Try to find the comment text
  if (properties["Comment"] && properties["Comment"].rich_text) {
    const richText = properties["Comment"].rich_text;
    if (richText.length > 0) {
      commentText = richText[0].plain_text;
    }
  }

  // No comment text found, try other field names
  if (!commentText) {
    for (const key of Object.keys(properties)) {
      if (
        key !== "Reply" && // Skip any reply fields
        properties[key].type === "rich_text"
      ) {
        const richText = properties[key].rich_text;
        if (richText && richText.length > 0) {
          commentText = richText[0].plain_text;
          console.log(`Found comment text in field: ${key}`);
          break;
        }
      }
    }
  }

  // Try to find username
  if (properties["Username"] && properties["Username"].rich_text) {
    const richText = properties["Username"].rich_text;
    if (richText.length > 0) {
      username = richText[0].plain_text;
    }
  }

  // Try to find account
  if (properties["Account"] && properties["Account"].rich_text) {
    const richText = properties["Account"].rich_text;
    if (richText.length > 0) {
      account = richText[0].plain_text;
    }
  }

  // Try to find created time
  if (properties["Created time"] && properties["Created time"].date) {
    createdTime = properties["Created time"].date.start;
  }

  // If no username, use a placeholder
  if (!username) {
    username = "user_" + Math.floor(Math.random() * 1000);
  }

  return {
    pageId,
    comment: commentText,
    username,
    account,
    createdTime,
  };
}

// Update Notion entries with generated replies
export async function updateNotionWithReplies(replies: Reply[]): Promise<any> {
  try {
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!databaseId) {
      throw new Error("Notion database ID not configured");
    }

    // Get authenticated Notion client
    console.log("Initializing Notion client for updates...");
    const notion = await createNotionClient();

    // First, get the database to understand its structure
    const database = await notion.databases.retrieve({
      database_id: databaseId,
    });

    // Identify the reply field name
    const properties = (database as any).properties;
    const propertyNames = Object.keys(properties);
    console.log("Available fields in database:", propertyNames.join(", "));

    // Find the reply field (with trimming to handle extra spaces)
    let replyFieldName = null;

    // First try exact matches
    for (const name of propertyNames) {
      const trimmedName = name.trim();
      if (
        trimmedName === "Reply" ||
        trimmedName === "reply" ||
        trimmedName === "Generated Reply" ||
        trimmedName === "Responded" ||
        trimmedName === "Response"
      ) {
        replyFieldName = name; // Use the original name with possible spaces
        console.log(`Found reply field with exact match: "${replyFieldName}"`);
        break;
      }
    }

    // If no exact match, try a more flexible approach
    if (!replyFieldName) {
      for (const name of propertyNames) {
        if (
          name.toLowerCase().includes("reply") ||
          name.toLowerCase().includes("response") ||
          name.toLowerCase().includes("responded")
        ) {
          replyFieldName = name;
          // console.log(
          //   `Found reply field with flexible match: "${replyFieldName}"`
          // );
          break;
        }
      }
    }

    // Last resort - explicitly check for " Reply" with a space
    if (!replyFieldName) {
      for (const name of propertyNames) {
        if (name === " Reply" || name === " reply") {
          replyFieldName = name;
          // console.log(
          //   `Found reply field with leading space: "${replyFieldName}"`
          // );
          break;
        }
      }
    }

    if (!replyFieldName) {
      throw new Error(
        `Could not find a reply field in the database. Available fields: ${propertyNames.join(
          ", "
        )}`
      );
    }

    // console.log(`Using reply field: "${replyFieldName}"`);

    // Get the type of the reply field to handle it correctly
    const replyFieldType = properties[replyFieldName].type;
    // console.log(`Reply field type: ${replyFieldType}`);

    const results = [];

    // Update each Notion page with the generated reply
    for (const reply of replies) {
      try {
        // console.log(
        //   `Updating Notion entry for comment by ${reply.username}...`
        // );

        // Create the properties object based on field type
        const updateProperties: any = {};

        if (replyFieldType === "rich_text") {
          updateProperties[replyFieldName] = {
            rich_text: [
              {
                text: {
                  content:
                    reply.generatedReply && reply.generatedReply.length > 2000
                      ? reply.generatedReply.substring(0, 1997) + "..."
                      : reply.generatedReply || "",
                },
              },
            ],
          };
        } else if (replyFieldType === "title") {
          updateProperties[replyFieldName] = {
            title: [
              {
                text: {
                  content:
                    reply.generatedReply && reply.generatedReply.length > 2000
                      ? reply.generatedReply.substring(0, 1997) + "..."
                      : reply.generatedReply || "",
                },
              },
            ],
          };
        } else {
          throw new Error(
            `Unsupported field type for replies: ${replyFieldType}`
          );
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

        // console.log(`Successfully updated Notion entry for ${reply.username}`);
      } catch (error: any) {
        console.error(
          `Error updating Notion entry for ${reply.username}:`,
          error
        );
        results.push({
          username: reply.username,
          success: false,
          error: error.message || "Unknown error",
        });
      }
    }

    return results;
  } catch (error: any) {
    console.error("Error in updateNotionWithReplies:", error);
    throw new Error(
      `Failed to update Notion entries with replies: ${error.message}`
    );
  }
}