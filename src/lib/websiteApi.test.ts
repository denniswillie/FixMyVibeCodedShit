import {
  ApiError,
  beginGoogleSignIn,
  getOnboardingConfig,
  getSession,
  saveOnboardingConfig,
} from "@/lib/websiteApi";

describe("websiteApi", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the current session with credentials included", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          authenticated: true,
          user: { id: 7, email: "founder@vibefix.demo" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    const result = await getSession();

    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
      })
    );
    expect(result.authenticated).toBe(true);
  });

  it("saves onboarding config through the backend api", async () => {
    const payload = {
      github: {
        repoUrl: "https://github.com/acme/fragile-launch",
        branch: "main",
        accessToken: "ghp_demo",
      },
      ssh: {
        host: "ec2-1-2-3-4.compute.amazonaws.com",
        port: "22",
        username: "ubuntu",
        privateKey: "private-key",
        dockerService: "web",
        logTail: "200",
      },
      schedule: {
        everyMinutes: "15",
        timezone: "Europe/Dublin",
      },
    };

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ config: payload }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await saveOnboardingConfig(payload);

    expect(fetch).toHaveBeenCalledWith(
      "/api/onboarding/config",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
    expect(result.config.github.repoUrl).toBe(payload.github.repoUrl);
  });

  it("surfaces backend error payloads", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "invalid_payload",
          message: "Enter the required operator details.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await expect(getOnboardingConfig()).rejects.toMatchObject(
      expect.objectContaining({
        code: "invalid_payload",
        message: "Enter the required operator details.",
      })
    );
  });

  it("redirects the browser into google auth", () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign },
    });

    beginGoogleSignIn();

    expect(assign).toHaveBeenCalledWith("/auth/google");
  });
});
