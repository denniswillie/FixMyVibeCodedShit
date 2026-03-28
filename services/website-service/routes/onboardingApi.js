const { Router } = require("express");
const { ZodError } = require("zod");

const { parseOnboardingConfig } = require("../services/onboardingSchemas");
const {
  clearSessionCookie,
  getSessionFromToken,
  readSessionTokenFromRequest
} = require("../services/sessionService");
const {
  getAgentConfigForUser,
  getLatestAgentRunForUser,
  upsertAgentConfig
} = require("../services/onboardingService");

async function requireAuthenticatedUser(req, res, pool) {
  const sessionToken = readSessionTokenFromRequest(req);
  const user = await getSessionFromToken({ db: pool, token: sessionToken });

  if (!user) {
    if (sessionToken) {
      clearSessionCookie(res);
    }

    res.status(401).json({
      error: "unauthorized",
      message: "Sign in before managing agent settings."
    });
    return null;
  }

  return user;
}

function buildOnboardingApiRouter({ pool }) {
  if (!pool) {
    throw new Error("buildOnboardingApiRouter requires pool");
  }

  const router = Router();

  router.get("/config", async (req, res) => {
    try {
      const user = await requireAuthenticatedUser(req, res, pool);

      if (!user) {
        return;
      }

      const [config, latestRun] = await Promise.all([
        getAgentConfigForUser({ dbPool: pool, userId: user.id }),
        getLatestAgentRunForUser({ dbPool: pool, userId: user.id })
      ]);
      return res.json({ config, latestRun });
    } catch (error) {
      console.error("[onboarding/config:get] error:", error);
      return res.status(500).json({
        error: "internal_error",
        message: "Unable to load the saved operator settings."
      });
    }
  });

  router.put("/config", async (req, res) => {
    try {
      const user = await requireAuthenticatedUser(req, res, pool);

      if (!user) {
        return;
      }

      const parsedConfig = parseOnboardingConfig(req.body);
      const config = await upsertAgentConfig({
        dbPool: pool,
        userId: user.id,
        config: parsedConfig
      });
      const latestRun = await getLatestAgentRunForUser({ dbPool: pool, userId: user.id });

      return res.status(200).json({ config, latestRun });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "invalid_payload",
          message: "Enter the required operator details.",
          fieldErrors: error.flatten()
        });
      }

      console.error("[onboarding/config:put] error:", error);
      return res.status(500).json({
        error: "internal_error",
        message: "Unable to save the operator settings right now."
      });
    }
  });

  return router;
}

module.exports = buildOnboardingApiRouter;
