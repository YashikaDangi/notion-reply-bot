"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const notion_oauth_service_1 = require("../services/notion-oauth-service");
exports.authRoutes = (0, express_1.Router)();
/**
 * Redirect to Notion OAuth authorization page
 */
exports.authRoutes.get("/login", (req, res) => {
    const authUrl = (0, notion_oauth_service_1.getAuthorizationUrl)();
    res.redirect(authUrl);
});
/**
 * OAuth callback handler
 */
exports.authRoutes.get("/callback", async (req, res) => {
    const { code, state } = req.query;
    if (!code) {
        return res.status(400).json({
            error: "Authorization code missing",
            details: "The authorization code was not returned from Notion"
        });
    }
    try {
        // Exchange the authorization code for an access token
        const tokenData = await (0, notion_oauth_service_1.exchangeCodeForToken)(code);
        // In a real application, you would store this token securely
        // For now, we'll store it in memory and show successful connection
        res.json({
            success: true,
            message: "Successfully authenticated with Notion",
            workspace: tokenData.workspace_name,
            expires_in: tokenData.expires_in
        });
    }
    catch (error) {
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
exports.authRoutes.post("/set-token", (req, res) => {
    const { token, expiresIn } = req.body;
    if (!token) {
        return res.status(400).json({
            error: "Token is required"
        });
    }
    try {
        (0, notion_oauth_service_1.setAccessToken)(token, expiresIn || 3600);
        res.json({
            success: true,
            message: "Access token set successfully"
        });
    }
    catch (error) {
        res.status(500).json({
            error: "Failed to set token",
            details: error.message
        });
    }
});
/**
 * Check authentication status
 */
exports.authRoutes.get("/status", (req, res) => {
    // In a real app, you would check if the token exists and is valid
    res.json({
        authenticated: true, // This is simplified; actual check would be more complex
        message: "Connected to Notion"
    });
});
