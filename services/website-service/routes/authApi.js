const { Router } = require("express");

const { toPublicUser } = require("../services/authService");
const {
  clearSessionCookie,
  getSessionFromToken,
  readSessionTokenFromRequest,
  revokeSession
} = require("../services/sessionService");

function buildAuthApiRouter({ pool }) {
  if (!pool) {
    throw new Error("buildAuthApiRouter requires pool");
  }

  const router = Router();

  router.get("/session", async (req, res) => {
    try {
      const sessionToken = readSessionTokenFromRequest(req);
      const user = await getSessionFromToken({ db: pool, token: sessionToken });

      if (!user) {
        if (sessionToken) {
          clearSessionCookie(res);
        }

        return res.json({ authenticated: false });
      }

      return res.json({
        authenticated: true,
        user: toPublicUser(user)
      });
    } catch (error) {
      console.error("[auth/session] error:", error);
      clearSessionCookie(res);
      return res.status(500).json({
        error: "internal_error",
        message: "Please try again in a moment."
      });
    }
  });

  router.post("/logout", async (req, res) => {
    try {
      const sessionToken = readSessionTokenFromRequest(req);
      await revokeSession({ db: pool, token: sessionToken });
      clearSessionCookie(res);
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("[auth/logout] error:", error);
      clearSessionCookie(res);
      return res.status(200).json({ ok: true });
    }
  });

  return router;
}

module.exports = buildAuthApiRouter;
