import githubAppService from "../../website-service/services/githubAppService.js";

const { createInstallationAccessToken } = githubAppService;

export function parseGithubRepoUrl(repoUrl) {
  const parsedUrl = new URL(repoUrl);
  const [owner, repo] = parsedUrl.pathname.replace(/^\/+/, "").replace(/\.git$/, "").split("/");

  if (!owner || !repo) {
    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
  }

  return { owner, repo };
}

export function buildAuthenticatedRepoUrl(repoUrl, accessToken) {
  const parsedUrl = new URL(repoUrl);
  parsedUrl.username = "x-access-token";
  parsedUrl.password = accessToken;
  return parsedUrl.toString();
}

export async function resolveGithubWriteToken(agentConfig) {
  if (agentConfig.github.installationId) {
    const tokenPayload = await createInstallationAccessToken(agentConfig.github.installationId);
    return String(tokenPayload?.token || "");
  }

  return String(agentConfig.github.accessToken || "");
}
