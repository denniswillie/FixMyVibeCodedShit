const crypto = require("crypto");

const { createOAuthStateToken, getFrontendUrl } = require("./googleOAuthService");

const GITHUB_APP_INSTALL_BASE_URL = "https://github.com";
const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";

function getGithubAppSlug() {
  return String(process.env.GITHUB_APP_SLUG || "").trim();
}

function getGithubAppId() {
  return String(process.env.GITHUB_APP_ID || "").trim();
}

function getGithubAppPrivateKey() {
  return String(process.env.GITHUB_APP_PRIVATE_KEY || "")
    .trim()
    .replace(/\\n/g, "\n");
}

function getGithubAppSetupUrl() {
  const configured = String(process.env.GITHUB_APP_SETUP_URL || "").trim();
  return configured || `${getFrontendUrl()}/auth/github/callback`;
}

function isGithubAppConfigured() {
  return Boolean(getGithubAppSlug() && getGithubAppId() && getGithubAppPrivateKey());
}

function buildGithubInstallationUrl(state) {
  if (!isGithubAppConfigured()) {
    throw new Error("GitHub App is not configured");
  }

  const url = new URL(`/apps/${getGithubAppSlug()}/installations/new`, GITHUB_APP_INSTALL_BASE_URL);
  url.search = new URLSearchParams({ state }).toString();
  return url.toString();
}

function base64url(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input), "utf8");
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createGithubAppJwt(now = Date.now()) {
  if (!isGithubAppConfigured()) {
    throw new Error("GitHub App is not configured");
  }

  const issuedAt = Math.floor(now / 1000) - 60;
  const expiresAt = issuedAt + 9 * 60;
  const encodedHeader = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const encodedPayload = base64url(
    JSON.stringify({
      iat: issuedAt,
      exp: expiresAt,
      iss: getGithubAppId()
    })
  );
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsignedToken).end().sign(getGithubAppPrivateKey());

  return `${unsignedToken}.${base64url(signature)}`;
}

async function githubApiRequest(pathname, { method = "GET", token, body } = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token || createGithubAppJwt()}`,
    "User-Agent": "vibefix-website-service",
    "X-GitHub-Api-Version": GITHUB_API_VERSION
  };

  const response = await fetch(new URL(pathname, GITHUB_API_BASE_URL), {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub API request failed (${response.status}): ${errorBody}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function createInstallationAccessToken(installationId) {
  return githubApiRequest(`/app/installations/${installationId}/access_tokens`, {
    method: "POST"
  });
}

async function fetchGithubInstallationContext(installationId) {
  const normalizedInstallationId = Number(installationId);

  if (!Number.isInteger(normalizedInstallationId) || normalizedInstallationId <= 0) {
    throw new Error("Invalid GitHub installation id");
  }

  const installation = await githubApiRequest(`/app/installations/${normalizedInstallationId}`);
  const tokenPayload = await createInstallationAccessToken(normalizedInstallationId);
  const repositoriesPayload = await githubApiRequest("/installation/repositories?per_page=100", {
    token: tokenPayload.token
  });

  const repositories = Array.isArray(repositoriesPayload?.repositories)
    ? repositoriesPayload.repositories.map((repository) => ({
        id: repository.id,
        name: repository.name,
        fullName: repository.full_name,
        htmlUrl: repository.html_url,
        defaultBranch: repository.default_branch
      }))
    : [];

  return {
    installationId: normalizedInstallationId,
    accountLogin: String(installation?.account?.login || ""),
    targetType: String(installation?.target_type || ""),
    repositorySelection: String(installation?.repository_selection || ""),
    repoCount: Number(repositoriesPayload?.total_count || repositories.length || 0),
    connectedAt: new Date().toISOString(),
    repositories
  };
}

module.exports = {
  buildGithubInstallationUrl,
  createGithubAppJwt,
  createOAuthStateToken,
  fetchGithubInstallationContext,
  getGithubAppSetupUrl,
  isGithubAppConfigured
};
