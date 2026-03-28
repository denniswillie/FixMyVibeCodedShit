const { Router } = require("express");

const { AuthServiceError, loginWithGoogleProfile } = require("../services/authService");
const {
  buildGoogleAuthorizationUrl,
  createOAuthStateToken,
  exchangeCodeForTokens,
  fetchGoogleUserProfile,
  getFrontendUrl,
  isGoogleOAuthConfigured
} = require("../services/googleOAuthService");
const {
  appendSetCookie,
  clearSessionCookie,
  parseCookies,
  serializeCookie,
  setSessionCookie
} = require("../services/sessionService");

const OAUTH_STATE_COOKIE_NAME = "vibefix_google_oauth_state";

function setOAuthStateCookie(res, stateToken) {
  appendSetCookie(
    res,
    serializeCookie(OAUTH_STATE_COOKIE_NAME, stateToken, {
      maxAge: 10 * 60,
      expires: new Date(Date.now() + 10 * 60 * 1000),
      httpOnly: true,
      path: "/",
      sameSite: "Lax",
      secure: String(process.env.NODE_ENV || "").trim().toLowerCase() === "production"
    })
  );
}

function clearOAuthStateCookie(res) {
  appendSetCookie(
    res,
    serializeCookie(OAUTH_STATE_COOKIE_NAME, "", {
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      path: "/",
      sameSite: "Lax",
      secure: String(process.env.NODE_ENV || "").trim().toLowerCase() === "production"
    })
  );
}

function buildFrontendRedirect(query = {}) {
  const url = new URL("/", `${getFrontendUrl()}/`);

  Object.entries(query).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

function buildGoogleAuthRouter({ pool }) {
  if (!pool) {
    throw new Error("buildGoogleAuthRouter requires pool");
  }

  const router = Router();

  router.get("/google", (_req, res) => {
    if (!isGoogleOAuthConfigured()) {
      return res.redirect(buildFrontendRedirect({ auth_error: "google_oauth_failed" }));
    }

    try {
      const stateToken = createOAuthStateToken();
      setOAuthStateCookie(res, stateToken);
      return res.redirect(buildGoogleAuthorizationUrl(stateToken));
    } catch (error) {
      console.error("[auth/google] error:", error);
      clearOAuthStateCookie(res);
      return res.redirect(buildFrontendRedirect({ auth_error: "google_oauth_failed" }));
    }
  });

  router.get("/google/callback", async (req, res) => {
    const cookies = parseCookies(req.headers?.cookie);
    const expectedState = cookies[OAUTH_STATE_COOKIE_NAME] || "";
    const returnedState = String(req.query?.state || "");
    const code = String(req.query?.code || "");

    clearOAuthStateCookie(res);

    if (!expectedState || !returnedState || expectedState !== returnedState || !code) {
      clearSessionCookie(res);
      return res.redirect(buildFrontendRedirect({ auth_error: "google_oauth_failed" }));
    }

    try {
      const tokens = await exchangeCodeForTokens(code);
      const profile = await fetchGoogleUserProfile(tokens.access_token);
      const payload = await loginWithGoogleProfile({
        dbPool: pool,
        profile,
        userAgent: req.get("user-agent"),
        ipAddress: req.ip
      });

      setSessionCookie(res, payload.sessionToken, payload.sessionExpiresAt);
      return res.redirect(buildFrontendRedirect({ auth: "google_success" }));
    } catch (error) {
      clearSessionCookie(res);

      if (error instanceof AuthServiceError) {
        return res.redirect(buildFrontendRedirect({ auth_error: error.code }));
      }

      console.error("[auth/google/callback] error:", error);
      return res.redirect(buildFrontendRedirect({ auth_error: "google_oauth_failed" }));
    }
  });

  return router;
}

module.exports = buildGoogleAuthRouter;
