import { ArrowLeft, ArrowUpRight, Github, RotateCcw } from "lucide-react";

import type {
  AgentRunUpdate,
  AuthenticatedUser,
  GitHubConnection,
  GitHubRepository,
  OnboardingDraft,
} from "@/types/onboarding";

interface GitHubDashboardProps {
  user: AuthenticatedUser;
  connection: GitHubConnection | null;
  repos: GitHubRepository[];
  config: OnboardingDraft;
  isLoading: boolean;
  message?: string | null;
  latestRun: AgentRunUpdate | null;
  latestFixRun: AgentRunUpdate | null;
  onBackToSetup: () => void;
  onSignOut: () => void;
  onConnectGitHub: () => void;
}

function repositorySelectionLabel(selection: string | undefined) {
  return selection === "all" ? "All repositories" : "Selected repositories";
}

function latestMoment(...values: Array<string | null | undefined>) {
  return values.find(Boolean) || null;
}

function formatRunStatus(status: AgentRunUpdate["status"] | undefined) {
  switch (status) {
    case "deployed":
      return "Fix deployed";
    case "fix_pushed":
      return "Fix pushed";
    case "needs_human":
      return "Needs review";
    case "failed":
      return "Run failed";
    case "no_issue":
      return "No issue";
    default:
      return "Running";
  }
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export const GitHubDashboard = ({
  user,
  connection,
  repos,
  config,
  isLoading,
  message = null,
  latestRun,
  latestFixRun,
  onBackToSetup,
  onSignOut,
  onConnectGitHub,
}: GitHubDashboardProps) => {
  const isConnected = Boolean(connection?.installationId);
  const visibleRun = latestFixRun;
  const visibleRunMoment = latestMoment(
    visibleRun?.deployedAt,
    visibleRun?.finishedAt,
    visibleRun?.startedAt,
    visibleRun?.createdAt
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[#07110f] text-sand">
      <div className="relative isolate">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,175,112,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(117,199,173,0.14),transparent_34%),linear-gradient(180deg,#091210_0%,#0d1715_54%,#07110f_100%)]" />
        <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-16 pt-8 sm:px-10">
          <header className="flex flex-col gap-6 border-b border-white/10 pb-8 md:flex-row md:items-start md:justify-between">
            <div>
              <button
                type="button"
                onClick={onBackToSetup}
                className="inline-flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-sand/62 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to setup
              </button>
              <p className="mt-8 font-display text-xs font-semibold uppercase tracking-[0.26em] text-sand/42">
                Vibefix dashboard
              </p>
              <h1 className="mt-4 max-w-3xl font-serif text-[clamp(2.4rem,5vw,5rem)] font-semibold leading-[0.98] text-sand">
                Repo access after the install flow should feel explicit, not hidden.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-sand/70">
                This page shows the repositories your GitHub App installation can reach right now,
                so founders can verify the exact blast radius before Vibefix touches a single line of code.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-sand/84">
                <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? "bg-moss" : "bg-ember"}`} />
                {isConnected ? "GitHub connected" : "GitHub pending"}
              </span>
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-sand/72 transition hover:border-white/24 hover:bg-white/6 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </header>

          <section className="grid gap-8 py-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[2.2rem] border border-white/10 bg-white/5 px-6 py-7 backdrop-blur-sm">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sand/45">
                Connected founder
              </p>
              <h2 className="mt-4 font-serif text-3xl font-semibold text-sand">
                {user.fullName || user.name || user.email}
              </h2>
              <p className="mt-2 text-sm leading-7 text-sand/68">{user.email}</p>
              {message ? (
                <p className="mt-6 rounded-[1.4rem] border border-white/8 bg-black/10 px-4 py-3 text-sm leading-7 text-sand/78">
                  {message}
                </p>
              ) : null}
              <div className="mt-6 grid gap-3 text-sm leading-7 text-sand/70 sm:grid-cols-2">
                <p>AWS region: {config.aws.region || "Pending"}</p>
                <p>Instance: {config.aws.instanceId || "Pending"}</p>
                <p>Docker service: {config.aws.dockerService || "Pending"}</p>
                <p>Schedule: every {config.schedule.everyMinutes || "15"} minutes</p>
              </div>
              <div className="mt-8 rounded-[1.6rem] border border-white/10 bg-black/10 px-5 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-sand/45">
                      Latest worker update
                    </p>
                    <h3 className="mt-3 font-serif text-2xl font-semibold text-sand">
                      {visibleRun ? formatRunStatus(visibleRun.status) : "No fix pushed yet"}
                    </h3>
                  </div>
                  {visibleRun ? (
                    <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-sand/76">
                      {formatTimestamp(visibleRunMoment)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 text-sm leading-7 text-sand/70">
                  {visibleRun?.summary || "Vibefix will only post an update here after it has pushed a repair to the repo."}
                </p>
                {visibleRun ? (
                  <div className="mt-5 grid gap-3 text-sm leading-7 text-sand/66 sm:grid-cols-2">
                    <p>Commit: {visibleRun.commitSha || "Pending"}</p>
                    <p>Branch: {visibleRun.branch || "Pending"}</p>
                    <p>Deploy: {visibleRun.deployed ? `Live at ${formatTimestamp(visibleRun.deployedAt)}` : visibleRun.pushed ? "Pushed, awaiting deploy" : "Not deployed"}</p>
                    <p>Classifier: {visibleRun.classifierReason || "Pending"}</p>
                  </div>
                ) : null}
                {visibleRun?.rootCause ? (
                  <p className="mt-4 text-sm leading-7 text-sand/62">
                    Root cause: {visibleRun.rootCause}
                  </p>
                ) : null}
                {visibleRun?.errorMessage ? (
                  <p className="mt-4 text-sm leading-7 text-[#ffb07a]">
                    {visibleRun.errorMessage}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-[2.2rem] border border-[#ffb07a]/18 bg-[#1b2623] px-6 py-7">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-[#ffb07a]/78">
                Installation state
              </p>
              {isConnected ? (
                <>
                  <h2 className="mt-4 font-serif text-3xl font-semibold text-sand">
                    @{connection?.accountLogin || "unknown"}
                  </h2>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-sand/70">
                    <p>{repositorySelectionLabel(connection?.repositorySelection)}</p>
                    <p>{connection?.repoCount || repos.length} repos currently available to the app</p>
                    <p>{connection?.targetType || "Account"} installation</p>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mt-4 font-serif text-3xl font-semibold text-sand">
                    No GitHub install yet
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-sand/70">
                    Finish the GitHub App install flow to see which repositories Vibefix can patch.
                  </p>
                  <button
                    type="button"
                    onClick={onConnectGitHub}
                    className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-[#ffb07a] px-6 font-display text-xs font-semibold uppercase tracking-[0.18em] text-[#0c1412] transition hover:bg-[#ffc08f]"
                  >
                    Give us access to your GitHub repo
                  </button>
                </>
              )}
            </div>
          </section>

          <section className="flex-1 rounded-[2.4rem] border border-white/10 bg-[#0d1715]/80 px-6 py-7 sm:px-8">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sand/45">
                  Accessible repositories
                </p>
                <h2 className="mt-4 font-serif text-3xl font-semibold text-sand">
                  {isLoading ? "Loading GitHub access" : repos.length ? `${repos.length} repos visible` : "No repositories visible yet"}
                </h2>
              </div>
              {isConnected ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-white/6 px-4 py-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-sand/70">
                  <Github className="h-4 w-4" />
                  {repositorySelectionLabel(connection?.repositorySelection)}
                </div>
              ) : null}
            </div>

            {isLoading ? (
              <div className="grid gap-4 py-8">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-24 animate-pulse rounded-[1.6rem] border border-white/8 bg-white/4"
                  />
                ))}
              </div>
            ) : repos.length ? (
              <ul className="divide-y divide-white/8">
                {repos.map((repo) => (
                  <li key={repo.id} className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-display text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-sand/45">
                        GitHub repository
                      </p>
                      <h3 className="mt-2 font-serif text-2xl font-semibold text-sand">{repo.fullName}</h3>
                      <p className="mt-2 text-sm leading-7 text-sand/62">
                        Default branch: {repo.defaultBranch}
                      </p>
                    </div>
                    <a
                      href={repo.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-[#ffb07a] transition hover:text-[#ffc08f]"
                    >
                      Open repo
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-10">
                <p className="max-w-2xl text-sm leading-7 text-sand/62">
                  {isConnected
                    ? "The GitHub App is installed, but this installation is not exposing any repositories yet. Re-run the install flow and confirm that at least one repository is selected."
                    : "Once the founder finishes the install flow, the selected repositories will appear here."}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};
