const {
  buildGoogleAuthorizationUrl,
  getGoogleRedirectUri,
  isGoogleOAuthConfigured
} = require("./googleOAuthService");

describe("googleOAuthService", () => {
  beforeEach(() => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "client-id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "client-secret";
    process.env.FRONTEND_URL = "http://localhost:5173";
    delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
  });

  it("detects when google oauth is configured", () => {
    expect(isGoogleOAuthConfigured()).toBe(true);
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "";
    expect(isGoogleOAuthConfigured()).toBe(false);
  });

  it("builds the default redirect uri from the frontend url", () => {
    expect(getGoogleRedirectUri()).toBe("http://localhost:5173/auth/google/callback");
  });

  it("builds a google authorization url with the expected params", () => {
    const url = new URL(buildGoogleAuthorizationUrl("state-token"));

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("state")).toBe("state-token");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:5173/auth/google/callback");
  });
});
