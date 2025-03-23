import { Router, Request, Response } from "express";
import { 
  exchangeCodeForToken, 
  getAuthorizationUrl, 
  setAccessToken 
} from "../services/notion-oauth-service";

export const authRoutes = Router();

/**
 * Redirect to Notion OAuth authorization page
 */
authRoutes.get("/login", (req: Request, res: Response) => {
  const authUrl = getAuthorizationUrl();
  res.redirect(authUrl);
});

/**
 * OAuth callback handler
 */
authRoutes.get("/callback", async (req: Request, res: Response) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).json({
      error: "Authorization code missing",
      details: "The authorization code was not returned from Notion"
    });
  }

  try {
    // Exchange the authorization code for an access token
    const tokenData = await exchangeCodeForToken(code as string);
    
    // In a real application, you would store this token securely
    // For now, we'll store it in memory and show successful connection

    res.json({
      success: true,
      message: "Successfully authenticated with Notion",
      workspace: tokenData.workspace_name,
      expires_in: tokenData.expires_in
    });
  } catch (error: any) {
    console.error("OAuth callback error:", error);
    res.status(500).json({
      error: "Authentication failed",
      details: error.message
    });
  }
});

/**
 * Manually set access token (for testing or when loading from secure storage)
 */
authRoutes.post("/set-token", (req: Request, res: Response) => {
  const { token, expiresIn } = req.body;
  
  if (!token) {
    return res.status(400).json({
      error: "Token is required"
    });
  }
  
  try {
    setAccessToken(token, expiresIn || 3600);
    res.json({
      success: true,
      message: "Access token set successfully"
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to set token",
      details: error.message
    });
  }
});

/**
 * Check authentication status
 */
authRoutes.get("/status", (req: Request, res: Response) => {
  // In a real app, you would check if the token exists and is valid
  res.json({
    authenticated: true, // This is simplified; actual check would be more complex
    message: "Connected to Notion"
  });
});