import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveSslRootCertPath() {
  const configuredPath = String(process.env.PGSSLROOTCERT || "").trim();
  const candidates = [];

  if (configuredPath) {
    candidates.push(configuredPath);

    if (!path.isAbsolute(configuredPath)) {
      candidates.push(path.resolve(process.cwd(), configuredPath));
      candidates.push(path.resolve(__dirname, configuredPath));
      candidates.push(path.resolve(__dirname, "../../", configuredPath));
    }
  }

  candidates.push(path.resolve(__dirname, "../../prod-ca-2021.crt"));

  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function buildSslConfig() {
  const sslEnabled = String(process.env.DB_SSL ?? "true").trim().toLowerCase() !== "false";

  if (!sslEnabled) {
    return false;
  }

  const sslRootCertPath = resolveSslRootCertPath();

  if (sslRootCertPath) {
    return {
      rejectUnauthorized: true,
      ca: fs.readFileSync(sslRootCertPath).toString(),
    };
  }

  const rejectUnauthorized =
    String(process.env.DB_SSL_REJECT_UNAUTHORIZED ?? "true").trim().toLowerCase() !== "false";

  return { rejectUnauthorized };
}

function buildPoolConfig() {
  const connectionString = String(process.env.DATABASE_URL || "").trim();
  const ssl = buildSslConfig();

  if (connectionString) {
    return {
      connectionString,
      ssl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      application_name: "vibefix-triage-runner",
    };
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 6543),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "vibefix-triage-runner",
  };
}

export const pool = new Pool(buildPoolConfig());

pool.on("error", (error) => {
  console.error("[triage-runner:pg] idle client error:", error);
});

export async function gracefulShutdown() {
  await pool.end();
}
