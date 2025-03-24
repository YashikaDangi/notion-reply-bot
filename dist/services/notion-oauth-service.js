"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchangeCodeForToken = exchangeCodeForToken;
exports.getAccessToken = getAccessToken;
exports.createNotionClient = createNotionClient;
exports.getAuthorizationUrl = getAuthorizationUrl;
exports.setAccessToken = setAccessToken;
const axios_1 = __importDefault(require("axios"));
const client_1 = require("@notionhq/client");
// Token storage - in a production environment, use a proper database
let accessToken = null;
let tokenExpiry = null;
/**
 * Exchanges an authorization code for an access token
 */
async function exchangeCodeForToken(code) {
    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    const redirectUri = process.env.NOTION_REDIRECT_URI;
    if (!clientId || !clientSecret) {
        throw new Error('Notion OAuth credentials not configured');
    }
    try {
        const response = await axios_1.default.post('https://api.notion.com/v1/oauth/token', {
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            auth: {
                username: clientId,
                password: clientSecret
            }
        });
        // Store the token with expiry time
        accessToken = response.data.access_token;
        tokenExpiry = Date.now() + (response.data.expires_in * 1000);
        return response.data;
    }
    catch (error) {
        console.error('Error exchanging code for token:', error.response?.data || error.message);
        throw new Error(`Failed to exchange authorization code: ${error.message}`);
    }
}
/**
 * Get the current access token, refreshing if needed
 */
async function getAccessToken() {
    // Check if we need a new token - no refresh token in Notion OAuth, so we rely on manual re-auth
    if (!accessToken || (tokenExpiry && Date.now() > tokenExpiry)) {
        // For now, we'll just throw an error requiring re-authentication
        // In a real app, you might redirect to auth flow or have a refresh token mechanism
        throw new Error('Notion access token expired or not available. Please re-authenticate.');
    }
    return accessToken;
}
/**
 * Create a Notion client with the current access token
 */
async function createNotionClient() {
    // Try to use the OAuth token first
    try {
        const token = await getAccessToken();
        return new client_1.Client({ auth: token });
    }
    catch (error) {
        // Fall back to API key if available (for development/testing)
        const apiKey = process.env.NOTION_API_KEY;
        if (apiKey) {
            console.log('Using fallback API key for Notion access');
            return new client_1.Client({ auth: apiKey });
        }
        throw new Error('No valid Notion authentication method available');
    }
}
/**
 * Generate the authorization URL for Notion OAuth
 */
function getAuthorizationUrl() {
    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.NOTION_REDIRECT_URI || '');
    const state = Math.random().toString(36).substring(2);
    return `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&state=${state}`;
}
/**
 * Manually set an access token (for testing or token from storage)
 */
function setAccessToken(token, expiresIn = 3600) {
    accessToken = token;
    tokenExpiry = Date.now() + (expiresIn * 1000);
}
