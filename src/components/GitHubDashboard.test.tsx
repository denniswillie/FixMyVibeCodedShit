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
        latestRun={{
          id: "run_123",
          status: "deployed",
          classifierReason: "actionable_error_detected",
          summary: "Patched checkout failures and redeployed GitBio.",
          rootCause: "Null checkout payload",
          fixSummary: "Added a serializer guard.",
          patchText: "diff --git a/app.js b/app.js",
          branch: "master",
          commitSha: "abc123def456",
          pushed: true,
          deployed: true,
          errorMessage: "",
          startedAt: "2026-03-28T15:00:00.000Z",
          finishedAt: "2026-03-28T15:01:00.000Z",
          deployedAt: "2026-03-28T15:02:00.000Z",
          createdAt: "2026-03-28T15:00:00.000Z",
        }}
        latestFixRun={{
          id: "run_122",
          status: "fix_pushed",
          classifierReason: "actionable_error_detected",
          summary: "Shipped a targeted checkout fix.",
          rootCause: "Null checkout payload",
          fixSummary: "Added a serializer guard.",
          patchText: "diff --git a/app.js b/app.js",
          branch: "master",
          commitSha: "fix123abc",
          pushed: true,
          deployed: false,
          errorMessage: "",
          startedAt: "2026-03-28T14:58:00.000Z",
          finishedAt: "2026-03-28T14:59:00.000Z",
          deployedAt: null,
          createdAt: "2026-03-28T14:58:00.000Z",
        }}
        onBackToSetup={vi.fn()}
        onSignOut={vi.fn()}
        onConnectGitHub={vi.fn()}
      />
    );

    expect(screen.getByText(/acme\/api/i)).toBeInTheDocument();
    expect(screen.getByText(/acme\/web/i)).toBeInTheDocument();
    expect(screen.getAllByText(/selected repositories/i)).toHaveLength(2);
    expect(screen.getByText(/shipped a targeted checkout fix\./i)).toBeInTheDocument();
    expect(screen.getByText(/commit: fix123abc/i)).toBeInTheDocument();
    expect(screen.getByText(/latest worker update/i)).toBeInTheDocument();
    expect(screen.getByText(/fix123abc/i)).toBeInTheDocument();
  });

  it("hides non-fix runs until a repair has actually been pushed", () => {
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
        repos={[]}
        config={buildDefaultDraft("Europe/Dublin")}
        isLoading={false}
        latestRun={{
          id: "run_999",
          status: "failed",
          classifierReason: "actionable_error_detected",
          summary: "The triage run crashed before it could finish.",
          rootCause: "",
          fixSummary: "",
          patchText: "",
          branch: "",
          commitSha: "",
          pushed: false,
          deployed: false,
          errorMessage: "file not found",
          startedAt: "2026-03-28T15:00:00.000Z",
          finishedAt: "2026-03-28T15:01:00.000Z",
          deployedAt: null,
          createdAt: "2026-03-28T15:00:00.000Z",
        }}
        latestFixRun={null}
        onBackToSetup={vi.fn()}
        onSignOut={vi.fn()}
        onConnectGitHub={vi.fn()}
      />
    );

    expect(screen.getByText(/no fix pushed yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(/vibefix will only post an update here after it has pushed a repair to the repo/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/the triage run crashed before it could finish/i)).not.toBeInTheDocument();
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
        latestRun={null}
        latestFixRun={null}
        onBackToSetup={vi.fn()}
        onSignOut={vi.fn()}
        onConnectGitHub={onConnectGitHub}
      />
    );

    await user.click(screen.getByRole("button", { name: /give us access to your github repo/i }));

    expect(onConnectGitHub).toHaveBeenCalledTimes(1);
  });
});
