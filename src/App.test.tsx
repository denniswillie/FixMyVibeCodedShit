import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "@/App";

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the authenticated session and enables onboarding", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authenticated: true,
            user: {
              id: 7,
              email: "founder@vibefix.demo",
              fullName: "Launch Founder",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            config: {
              github: {
                repoUrl: "https://github.com/acme/backend-loaded",
                branch: "main",
                accessToken: "",
                connection: {
                  installationId: 42,
                  accountLogin: "acme",
                  targetType: "Organization",
                  repositorySelection: "selected",
                  repoCount: 1,
                  connectedAt: "2026-03-28T14:00:00.000Z",
                },
              },
              ssh: {
                host: "ec2-1-2-3-4.compute.amazonaws.com",
                port: 22,
                username: "ubuntu",
                privateKey: "private-key",
                dockerService: "web",
                logTail: 200,
              },
              schedule: {
                everyMinutes: 15,
                timezone: "Europe/Dublin",
              },
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );

    render(<App />);

    expect(await screen.findByText(/launch founder/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/repository url/i)).toBeEnabled();
    expect(screen.getByLabelText(/repository url/i)).toHaveValue(
      "https://github.com/acme/backend-loaded"
    );
    expect(screen.getByText(/connected to/i)).toBeInTheDocument();
  });

  it("starts real google oauth when the hero button is pressed", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign, search: "", pathname: "/" },
    });
    const user = userEvent.setup();

    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: /continue with google/i })
    );

    expect(assign).toHaveBeenCalledWith("/auth/google");
  });

  it("starts github repo access when the onboarding button is pressed", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authenticated: true,
            user: {
              id: 7,
              email: "founder@vibefix.demo",
              fullName: "Launch Founder",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            config: {
              github: {
                repoUrl: "https://github.com/acme/backend-loaded",
                branch: "main",
                accessToken: "",
                connection: null,
              },
              ssh: {
                host: "ec2-1-2-3-4.compute.amazonaws.com",
                port: 22,
                username: "ubuntu",
                privateKey: "private-key",
                dockerService: "web",
                logTail: 200,
              },
              schedule: {
                everyMinutes: 15,
                timezone: "Europe/Dublin",
              },
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );

    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign, search: "", pathname: "/" },
    });
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /give us access to your github repo/i }));

    expect(assign).toHaveBeenCalledWith("/auth/github");
  });
});
