const crypto = require("crypto");

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

function getGoogleClientId() {
  return String(process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
}

function getGoogleClientSecret() {
  return String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
}

function getFrontendUrl() {
  return String(process.env.FRONTEND_URL || "http://localhost:5173")
    .trim()
    .replace(/\/+$/, "");
}

function getGoogleRedirectUri() {
  const configured = String(process.env.GOOGLE_OAUTH_REDIRECT_URI || "").trim();
  return configured || `${getFrontendUrl()}/auth/google/callback`;
}

function isGoogleOAuthConfigured() {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

function createOAuthStateToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function buildGoogleAuthorizationUrl(state) {
  if (!isGoogleOAuthConfigured()) {
    throw new Error("Google OAuth is not configured");
  }

  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account"
  }).toString();

  return url.toString();
}

async function exchangeCodeForTokens(code) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: getGoogleRedirectUri(),
      grant_type: "authorization_code"
    }).toString()
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

async function fetchGoogleUserProfile(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google userinfo failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

module.exports = {
  buildGoogleAuthorizationUrl,
  createOAuthStateToken,
  exchangeCodeForTokens,
  fetchGoogleUserProfile,
  getFrontendUrl,
  getGoogleRedirectUri,
  isGoogleOAuthConfigured
};
