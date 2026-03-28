import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GitHubDashboard } from "@/components/GitHubDashboard";
import { buildDefaultDraft } from "@/lib/onboarding";

describe("GitHubDashboard", () => {
  it("renders the connected repositories", () => {
    render(
      <GitHubDashboard
        user={{
          email: "founder@vibefix.demo",
          fullName: "Launch Founder",
        }}
        connection={{
          installationId: 42,
          accountLogin: "acme",
          targetType: "Organization",
          repositorySelection: "selected",
          repoCount: 2,
          connectedAt: "2026-03-28T15:00:00.000Z",
        }}
        repos={[
          {
            id: 1,
            name: "api",
            fullName: "acme/api",
            htmlUrl: "https://github.com/acme/api",
            defaultBranch: "main",
          },
          {
            id: 2,
            name: "web",
            fullName: "acme/web",
            htmlUrl: "https://github.com/acme/web",
            defaultBranch: "trunk",
          },
        ]}
        config={buildDefaultDraft("Europe/Dublin")}
        isLoading={false}
        onBackToSetup={vi.fn()}
        onSignOut={vi.fn()}
        onConnectGitHub={vi.fn()}
      />
    );

    expect(screen.getByText(/acme\/api/i)).toBeInTheDocument();
    expect(screen.getByText(/acme\/web/i)).toBeInTheDocument();
    expect(screen.getAllByText(/selected repositories/i)).toHaveLength(2);
  });

  it("can restart the github install flow from the empty state", async () => {
    const user = userEvent.setup();
    const onConnectGitHub = vi.fn();

    render(
      <GitHubDashboard
        user={{
          email: "founder@vibefix.demo",
          fullName: "Launch Founder",
        }}
        connection={null}
        repos={[]}
        config={buildDefaultDraft("Europe/Dublin")}
        isLoading={false}
        onBackToSetup={vi.fn()}
        onSignOut={vi.fn()}
        onConnectGitHub={onConnectGitHub}
      />
    );

    await user.click(screen.getByRole("button", { name: /give us access to your github repo/i }));

    expect(onConnectGitHub).toHaveBeenCalledTimes(1);
  });
});
