import OpenAI from "openai";

export async function generateReplyWithDeepSeek(
  comment: string,
  username: string
): Promise<string> {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      throw new Error("DeepSeek API key is not configured");
    }

    // Initialize the OpenAI client with DeepSeek's baseURL
    const openai = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: apiKey,
    });

    const userMessage = `I have instagram accounts and I recieve comments and they have to replied to
This is a comment I have just recieved "${comment}"
Please generate a reply for this, if they have written a statement agree to their statement in a playful way, if they are asking a question then try to answer it, if it is all emoji then reply in an all emoji fashion that are relevant.
Make it conversational if you can without being intrusive or clingy, speak like an indian author who is in their late 20s and use gen z conversational slangs.
If you are confused about the context and unsure what the reply should be then just 3 emojis that are relevant should be the reply.
If the comment contains "@" then they are speaking to someone else, in this case just enter 3 different heart emojis, only make it conversational with them if they are lacking logic while asking a connecting question that might make them feel like we are interested while maintaining empathy.
Make sure you are not rude and mean to anyone. Always reply with warmth and mild humour.
The result should contain only the reply, I will be sending this right away without any changes.
Don't include any "" in the result. and Don't include any capital letters.`;

    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        // Empty system message
        { role: "system", content: "" },
        // Former system message content is now the user message
        { role: "user", content: userMessage },
      ],
      max_tokens: 2048,
      temperature: 1.0,
    });

    // Extract the reply content
    const reply = completion.choices[0]?.message.content?.trim() || "";

    return reply;
  } catch (error: any) {
    console.error("Error generating reply with DeepSeek:", error);

    // Get the error message from the error object
    const errorMessage =
      error.message ||
      error.response?.data?.error?.message ||
      "Unknown error occurred";

    // Return a fallback response instead of throwing an error
    console.log(`Returning fallback response due to error: ${errorMessage}`);
    return "Thanks for your comment! 👍";
  }
}