const crypto = require("crypto");

const {
  buildGithubInstallationUrl,
  createGithubAppJwt,
  fetchGithubInstallationContext,
  getGithubAppSetupUrl,
  isGithubAppConfigured
} = require("./githubAppService");

function decodeBase64UrlJson(segment) {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

describe("githubAppService", () => {
  beforeEach(() => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048
    });

    process.env.GITHUB_APP_SLUG = "vibefix";
    process.env.GITHUB_APP_ID = "123456";
    process.env.GITHUB_APP_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" });
    process.env.FRONTEND_URL = "https://fixmyvibecodedshit.com";
    delete process.env.GITHUB_APP_SETUP_URL;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects when the github app is configured", () => {
    expect(isGithubAppConfigured()).toBe(true);
    process.env.GITHUB_APP_PRIVATE_KEY = "";
    expect(isGithubAppConfigured()).toBe(false);
  });

  it("builds the default setup callback from the frontend url", () => {
    expect(getGithubAppSetupUrl()).toBe("https://fixmyvibecodedshit.com/auth/github/callback");
  });

  it("builds the github installation url with state", () => {
    const url = new URL(buildGithubInstallationUrl("state-token"));

    expect(url.origin + url.pathname).toBe("https://github.com/apps/vibefix/installations/new");
    expect(url.searchParams.get("state")).toBe("state-token");
  });

  it("creates a github app jwt with the configured app id", () => {
    const token = createGithubAppJwt(new Date("2026-03-28T14:00:00.000Z").getTime());
    const [, payload] = token.split(".");

    expect(decodeBase64UrlJson(payload)).toMatchObject({
      iss: "123456"
    });
  });

  it("fetches installation context and repositories", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            account: { login: "acme" },
            target_type: "Organization",
            repository_selection: "selected"
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "installation-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            total_count: 1,
            repositories: [
              {
                id: 99,
                name: "fragile-launch",
                full_name: "acme/fragile-launch",
                html_url: "https://github.com/acme/fragile-launch",
                default_branch: "main"
              }
            ]
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      );

    const result = await fetchGithubInstallationContext("789");

    expect(result).toMatchObject({
      installationId: 789,
      accountLogin: "acme",
      targetType: "Organization",
      repositorySelection: "selected",
      repoCount: 1,
      repositories: [
        {
          fullName: "acme/fragile-launch",
          htmlUrl: "https://github.com/acme/fragile-launch"
        }
      ]
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
