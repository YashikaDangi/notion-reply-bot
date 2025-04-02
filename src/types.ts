// types.ts
export interface Reply {
    username: string;
    comment: string;
    generatedReply: string;
  }
  
  export interface NotionUpdateResult {
    username: string;
    notionPageId: string;
    success: boolean;
    error?: string;
  }
  
  export interface ProcessUnrepliedResponse {
    success: boolean;
    data?: {
      totalFound: number;
      processed: number;
      replies: Reply[];
      notionUpdateResults?: NotionUpdateResult[];
    };
    error?: string;
    details?: string;
    message?: string;
    hint?: string;
  }