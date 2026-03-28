const { Router } = require("express");

const { getFrontendUrl } = require("../services/googleOAuthService");
const {
  buildGithubInstallationUrl,
  createOAuthStateToken,
  fetchGithubInstallationContext,
  isGithubAppConfigured
} = require("../services/githubAppService");
const {
  appendSetCookie,
  clearSessionCookie,
  parseCookies,
  readSessionTokenFromRequest,
  serializeCookie,
  getSessionFromToken
} = require("../services/sessionService");
const { connectGithubInstallationForUser } = require("../services/onboardingService");

const OAUTH_STATE_COOKIE_NAME = "vibefix_github_install_state";

function setGithubStateCookie(res, stateToken) {
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

function clearGithubStateCookie(res) {
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

async function requireAuthenticatedUser(req, pool) {
  const sessionToken = readSessionTokenFromRequest(req);
  return getSessionFromToken({ db: pool, token: sessionToken });
}

function buildGithubAuthRouter({ pool }) {
  if (!pool) {
    throw new Error("buildGithubAuthRouter requires pool");
  }

  const router = Router();

  router.get("/github", async (req, res) => {
    if (!isGithubAppConfigured()) {
      return res.redirect(buildFrontendRedirect({ github_error: "github_app_not_configured" }));
    }

    try {
      const user = await requireAuthenticatedUser(req, pool);

      if (!user) {
        clearSessionCookie(res);
        return res.redirect(buildFrontendRedirect({ github_error: "unauthorized" }));
      }

      const stateToken = createOAuthStateToken();
      setGithubStateCookie(res, stateToken);
      return res.redirect(buildGithubInstallationUrl(stateToken));
    } catch (error) {
      console.error("[auth/github] error:", error);
      clearGithubStateCookie(res);
      return res.redirect(buildFrontendRedirect({ github_error: "github_connect_failed" }));
    }
  });

  router.get("/github/callback", async (req, res) => {
    const cookies = parseCookies(req.headers?.cookie);
    const expectedState = cookies[OAUTH_STATE_COOKIE_NAME] || "";
    const returnedState = String(req.query?.state || "");
    const installationId = String(req.query?.installation_id || "");

    clearGithubStateCookie(res);

    if (!expectedState || !returnedState || expectedState !== returnedState || !installationId) {
      return res.redirect(buildFrontendRedirect({ github_error: "github_connect_failed" }));
    }

    try {
      const user = await requireAuthenticatedUser(req, pool);

      if (!user) {
        clearSessionCookie(res);
        return res.redirect(buildFrontendRedirect({ github_error: "unauthorized" }));
      }

      const installation = await fetchGithubInstallationContext(installationId);
      await connectGithubInstallationForUser({
        dbPool: pool,
        userId: user.id,
        installation
      });

      return res.redirect(buildFrontendRedirect({ github: "connected" }));
    } catch (error) {
      console.error("[auth/github/callback] error:", error);
      return res.redirect(buildFrontendRedirect({ github_error: "github_connect_failed" }));
    }
  });

  return router;
}

module.exports = buildGithubAuthRouter;
