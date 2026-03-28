const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: false });
dotenv.config();

const { pool, gracefulShutdown } = require("./db");
const buildAuthApiRouter = require("./routes/authApi");
const buildGithubApiRouter = require("./routes/githubApi");
const buildGithubAuthRouter = require("./routes/authGithub");
const buildGoogleAuthRouter = require("./routes/authGoogle");
const buildOnboardingApiRouter = require("./routes/onboardingApi");

function resolveStaticDir() {
  const candidates = [
    path.join(__dirname, "public"),
    path.resolve(__dirname, "../../dist")
  ];

  return candidates.find((candidate) => fs.existsSync(path.join(candidate, "index.html"))) || "";
}

function parseAllowedOrigins() {
  const defaults = [
    "https://fixmyvibecodedshit.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080"
  ];
  const configured = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set([...defaults, ...configured]);
}

const app = express();
const port = Number(process.env.PORT || 8080);
const staticDir = resolveStaticDir();
const allowedOrigins = parseAllowedOrigins();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(express.json());

app.get("/healthz", (_req, res) => {
  return res.status(200).json({ status: "ok" });
});

app.get("/readyz", async (_req, res) => {
  try {
    await pool.query("select 1");
    return res.status(200).json({ status: "ready" });
  } catch (error) {
    console.error("[readyz] database probe failed:", error);
    return res.status(503).json({ status: "not_ready" });
  }
});

app.use("/api/auth", buildAuthApiRouter({ pool }));
app.use("/api/github", buildGithubApiRouter({ pool }));
app.use("/api/onboarding", buildOnboardingApiRouter({ pool }));
app.use("/auth", buildGithubAuthRouter({ pool }));
app.use("/auth", buildGoogleAuthRouter({ pool }));
app.use("/api", (_req, res) => {
  return res.status(404).json({
    error: "not_found",
    message: "API route not found."
  });
});

if (staticDir) {
  app.use(express.static(staticDir));

  app.get("*", (_req, res) => {
    return res.sendFile(path.join(staticDir, "index.html"));
  });
}

const server = app.listen(port, () => {
  console.log(`[website-service] listening on http://localhost:${port}`);
});

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`[website-service] received ${signal}, shutting down...`);

  server.close(async () => {
    try {
      await gracefulShutdown();
    } catch (error) {
      console.error("[website-service] graceful shutdown failed:", error);
    } finally {
      process.exit(0);
    }
  });

  setTimeout(() => {
    console.error("[website-service] forcing shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
