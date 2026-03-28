const { Router } = require("express");

const { fetchGithubInstallationContext, isGithubAppConfigured } = require("../services/githubAppService");
const { getAgentConfigForUser } = require("../services/onboardingService");
const {
  clearSessionCookie,
  getSessionFromToken,
  readSessionTokenFromRequest
} = require("../services/sessionService");

async function requireAuthenticatedUser(req, res, pool) {
  const sessionToken = readSessionTokenFromRequest(req);
  const user = await getSessionFromToken({ db: pool, token: sessionToken });

  if (!user) {
    if (sessionToken) {
      clearSessionCookie(res);
    }

    res.status(401).json({
      error: "unauthorized",
      message: "Sign in before viewing GitHub access."
    });
    return null;
  }

  return user;
}

function buildGithubApiRouter({ pool }) {
  if (!pool) {
    throw new Error("buildGithubApiRouter requires pool");
  }

  const router = Router();

  router.get("/repos", async (req, res) => {
    try {
      const user = await requireAuthenticatedUser(req, res, pool);

      if (!user) {
        return;
      }

      const config = await getAgentConfigForUser({ dbPool: pool, userId: user.id });
      const installationId = config.github.connection?.installationId;

      if (!installationId) {
        return res.json({
          connected: false,
          connection: null,
          repos: []
        });
      }

      if (!isGithubAppConfigured()) {
        return res.status(503).json({
          error: "github_app_not_configured",
          message: "GitHub repo access is not configured on the server."
        });
      }

      const installation = await fetchGithubInstallationContext(installationId);

      return res.json({
        connected: true,
        connection: {
          installationId: installation.installationId,
          accountLogin: installation.accountLogin,
          targetType: installation.targetType,
          repositorySelection: installation.repositorySelection,
          repoCount: installation.repoCount,
          connectedAt: config.github.connection?.connectedAt || installation.connectedAt
        },
        repos: installation.repositories
      });
    } catch (error) {
      console.error("[github/repos] error:", error);
      return res.status(502).json({
        error: "github_installation_unavailable",
        message: "Unable to load the connected GitHub repositories right now."
      });
    }
  });

  return router;
}

module.exports = buildGithubApiRouter;
