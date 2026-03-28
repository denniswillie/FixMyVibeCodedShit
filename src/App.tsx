import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { ArrowDownRight, Github, Server, WandSparkles } from "lucide-react";

import { CommandPreview } from "@/components/CommandPreview";
import { CredentialsForm } from "@/components/CredentialsForm";
import { DemoAuthPanel } from "@/components/DemoAuthPanel";
import { GitHubDashboard } from "@/components/GitHubDashboard";
import { HeroScene } from "@/components/HeroScene";
import { buildDefaultDraft, isDraftReady } from "@/lib/onboarding";
import {
  ApiError,
  beginGithubRepoAccess,
  beginGoogleSignIn,
  getGithubRepos,
  getOnboardingConfig,
  getSession,
  logout,
  saveOnboardingConfig,
} from "@/lib/websiteApi";
import type {
  AgentRunUpdate,
  AuthenticatedUser,
  GitHubConnection,
  GitHubRepository,
  OnboardingDraft,
} from "@/types/onboarding";

const operators = [
  {
    icon: Server,
    title: "Read the real box",
    body: "The worker runs the SSM log probe itself against the EC2 instance you specify instead of guessing from synthetic health checks.",
  },
  {
    icon: Github,
    title: "Patch the repo directly",
    body: "When the logs show breakage, the Daytona workspace gets GitHub write access so the fix can be committed back to the real codebase.",
  },
  {
    icon: WandSparkles,
    title: "No-op when nothing is wrong",
    body: "Healthy logs should not trigger code churn. The worker exits cleanly until the next scheduled run.",
  },
];

function normalizeDraft(config: OnboardingDraft): OnboardingDraft {
  return {
    github: {
      ...config.github,
      branch: String(config.github.branch),
      accessToken: String(config.github.accessToken),
      repoUrl: String(config.github.repoUrl),
      connection: config.github.connection
        ? {
            ...config.github.connection,
            installationId: Number(config.github.connection.installationId),
            repoCount: Number(config.github.connection.repoCount),
            connectedAt: config.github.connection.connectedAt,
          }
        : null,
    },
    aws: {
      ...config.aws,
      accessKeyId: String(config.aws.accessKeyId),
      secretAccessKey: String(config.aws.secretAccessKey),
      sessionToken: String(config.aws.sessionToken),
      region: String(config.aws.region),
      instanceId: String(config.aws.instanceId),
      dockerService: String(config.aws.dockerService),
      logTail: String(config.aws.logTail),
    },
    schedule: {
      everyMinutes: String(config.schedule.everyMinutes),
      timezone: String(config.schedule.timezone),
    },
  };
}

function normalizeLatestRun(run: AgentRunUpdate | null | undefined): AgentRunUpdate | null {
  if (!run) {
    return null;
  }

  return {
    ...run,
    id: String(run.id),
    status: run.status,
    classifierReason: String(run.classifierReason || ""),
    summary: String(run.summary || ""),
    rootCause: String(run.rootCause || ""),
    fixSummary: String(run.fixSummary || ""),
    patchText: String(run.patchText || ""),
    branch: String(run.branch || ""),
    commitSha: String(run.commitSha || ""),
    pushed: Boolean(run.pushed),
    deployed: Boolean(run.deployed),
    errorMessage: String(run.errorMessage || ""),
    startedAt: run.startedAt || null,
    finishedAt: run.finishedAt || null,
    deployedAt: run.deployedAt || null,
    createdAt: run.createdAt || null,
  };
}

const App = () => {
  const setupRef = useRef<HTMLElement>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [draft, setDraft] = useState<OnboardingDraft>(() => buildDefaultDraft());
  const [pathname, setPathname] = useState(() => window.location.pathname || "/");
  const [authLoading, setAuthLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(false);
  const [githubReposLoading, setGithubReposLoading] = useState(false);
  const [githubRepos, setGithubRepos] = useState<GitHubRepository[]>([]);
  const [githubConnection, setGithubConnection] = useState<GitHubConnection | null>(null);
  const [latestRun, setLatestRun] = useState<AgentRunUpdate | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const deferredDraft = useDeferredValue(draft);
  const isDashboard = pathname === "/dashboard";

  const scrollToSetup = () => {
    const setupElement = setupRef.current;
    if (setupElement && typeof setupElement.scrollIntoView === "function") {
      setupElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const navigateTo = (nextPath: string, options?: { replace?: boolean }) => {
    if (options?.replace) {
      window.history.replaceState({}, document.title, nextPath);
    } else {
      window.history.pushState({}, document.title, nextPath);
    }
    setPathname(nextPath);
  };

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname || "/");
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const searchParams = new URLSearchParams(window.location.search);
    const authStatus = searchParams.get("auth");
    const authError = searchParams.get("auth_error");
    const githubStatus = searchParams.get("github");
    const githubError = searchParams.get("github_error");

    const bootstrap = async () => {
      setAuthLoading(true);

      try {
        const session = await getSession();

        if (!isActive) {
          return;
        }

        if (authStatus === "google_success") {
          setMessage("Google sign-in completed. Enter the operator credentials below.");
        } else if (githubStatus === "connected") {
          setMessage("GitHub repo access connected. Upload the AWS credentials file, fill the EC2 target, and save the operator config.");
        } else if (authError) {
          setMessage(`Google sign-in failed: ${authError.split("_").join(" ")}.`);
        } else if (githubError) {
          setMessage(`GitHub connect failed: ${githubError.split("_").join(" ")}.`);
        }

        if (!session.authenticated || !session.user) {
          startTransition(() => {
            setUser(null);
            setDraft(buildDefaultDraft());
            setGithubRepos([]);
            setGithubConnection(null);
            setLatestRun(null);
          });
          if (window.location.pathname === "/dashboard") {
            navigateTo("/", { replace: true });
          }
          setAuthLoading(false);
          return;
        }

        const sessionUser = session.user;
        startTransition(() => {
          setUser({
            ...sessionUser,
            name: sessionUser.fullName || sessionUser.email,
            company: "Google account connected",
          });
        });
        setConfigLoading(true);

        const onboarding = await getOnboardingConfig();

        if (!isActive) {
          return;
        }

        startTransition(() => {
          const normalizedConfig = normalizeDraft(onboarding.config);
          setDraft(normalizedConfig);
          setGithubConnection(normalizedConfig.github.connection);
          setLatestRun(normalizeLatestRun(onboarding.latestRun));
        });

        const normalizedConfig = normalizeDraft(onboarding.config);
        const ready = isDraftReady(normalizedConfig);

        if (!ready && window.location.pathname === "/dashboard") {
          navigateTo("/", { replace: true });
          setAuthLoading(false);
          setConfigLoading(false);
          return;
        }

        if (ready && window.location.pathname !== "/dashboard") {
          navigateTo("/dashboard", { replace: true });
          setAuthLoading(false);
          setConfigLoading(false);
          return;
        }

        if (window.location.pathname === "/dashboard") {
          setGithubReposLoading(true);

          if (normalizedConfig.github.connection?.installationId) {
            const githubAccess = await getGithubRepos();

            if (!isActive) {
              return;
            }

            startTransition(() => {
              setGithubRepos(githubAccess.repos);
              setGithubConnection(githubAccess.connection);
            });
          } else {
            startTransition(() => {
              setGithubRepos([]);
              setGithubConnection(null);
            });
          }
        } else {
          startTransition(() => {
            setGithubRepos([]);
          });
        }
      } catch (error) {
        if (!isActive) {
          return;
        }

        setMessage(
          error instanceof ApiError
            ? error.message
            : "Unable to reach the website service right now."
        );
      } finally {
        if (!isActive) {
          return;
        }

        setAuthLoading(false);
        setConfigLoading(false);
        setGithubReposLoading(false);
        if (authStatus || authError || githubStatus || githubError) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    };

    void bootstrap();

    return () => {
      isActive = false;
    };
  }, [pathname]);

  const handleSignIn = () => {
    beginGoogleSignIn();
  };

  const handleGithubConnect = () => {
    beginGithubRepoAccess();
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch {
      // Keep the UI moving even if logout cleanup fails server-side.
    }

    startTransition(() => {
      setUser(null);
      setDraft(buildDefaultDraft());
      setGithubRepos([]);
      setGithubConnection(null);
      setLatestRun(null);
    });
    setSaveState("idle");
    setMessage("Signed out. Sign in again to continue configuring the operator.");
    if (pathname === "/dashboard") {
      navigateTo("/", { replace: true });
    }
  };

  const handleSave = async () => {
    if (!user) {
      return;
    }

    setSaveState("saving");
    setMessage(null);

    try {
      const result = await saveOnboardingConfig(draft);
      startTransition(() => {
        const normalizedConfig = normalizeDraft(result.config);
        setDraft(normalizedConfig);
        setGithubConnection(normalizedConfig.github.connection);
        setLatestRun(normalizeLatestRun(result.latestRun));
      });
      setSaveState("saved");
      if (isDraftReady(normalizeDraft(result.config))) {
        setMessage("Operator credentials saved. The worker can pick this user up on the next run.");
        navigateTo("/dashboard");
      } else {
        setMessage("Operator credentials saved. Finish the remaining setup fields to arm the worker.");
      }
    } catch (error) {
      setSaveState("error");
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to save the operator settings right now."
      );
    }
  };

  if (user && isDashboard) {
    return (
      <GitHubDashboard
        user={user}
        connection={githubConnection}
        repos={githubRepos}
        config={draft}
        isLoading={authLoading || configLoading || githubReposLoading}
        message={message}
        latestRun={latestRun}
        onBackToSetup={() => navigateTo("/")}
        onSignOut={() => void handleSignOut()}
        onConnectGitHub={handleGithubConnect}
      />
    );
  }

  return (
    <div className="bg-[#f4ead9] text-ink">
      <HeroScene
        isSignedIn={Boolean(user)}
        onPrimaryAction={user ? scrollToSetup : handleSignIn}
        onSecondaryAction={scrollToSetup}
      />

      <main>
        <section
          ref={setupRef}
          className="relative overflow-hidden bg-[#f4ead9] px-6 pb-24 pt-20 sm:px-10"
        >
          <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(7,17,15,0.1),transparent)]" />
          <div className="mx-auto max-w-6xl">
            <div className="max-w-3xl">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
                Demo onboarding
              </p>
              <h2 className="mt-4 font-serif text-[clamp(2.2rem,4vw,3.7rem)] font-semibold leading-[1.02] text-ink">
                The website only needs to gather the credentials your first
                worker actually consumes.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-ink/68">
                Google sign-in identifies the founder. GitHub grants repo
                write-back. One uploaded AWS credentials file grants SSM log access.
                The setup only keeps the EC2 target details that the upload cannot
                infer on its own.
              </p>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
              <div className="space-y-8">
                <DemoAuthPanel
                  user={user}
                  isLoading={authLoading}
                  message={message}
                  onSignIn={handleSignIn}
                  onSignOut={handleSignOut}
                />

                <section className="grid gap-5">
                  {operators.map(({ icon: Icon, title, body }) => (
                    <div key={title} className="flex gap-4">
                      <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-sand">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-ink">
                          {title}
                        </h3>
                        <p className="mt-2 max-w-md text-sm leading-7 text-ink/68">
                          {body}
                        </p>
                      </div>
                    </div>
                  ))}
                </section>
              </div>

              <div className="space-y-8">
                <CredentialsForm
                  value={draft}
                  disabled={!user || configLoading}
                  onConnectGitHub={handleGithubConnect}
                  onChange={setDraft}
                />
                <section className="rounded-[2rem] border border-ink/10 bg-white px-6 py-6 shadow-panel">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">
                        Persist config
                      </p>
                      <p className="mt-2 text-sm leading-7 text-ink/68">
                        Save the credentials into Supabase so the worker can load
                        them later for the scheduled triage run.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!user || !isDraftReady(draft) || saveState === "saving" || configLoading}
                      className="inline-flex h-12 items-center justify-center rounded-full bg-ink px-6 font-display text-sm font-semibold uppercase tracking-[0.16em] text-sand transition hover:bg-[#10211e] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {configLoading
                        ? "Loading saved config"
                        : saveState === "saving"
                          ? "Saving"
                          : saveState === "saved"
                            ? "Saved"
                            : "Save operator config"}
                    </button>
                  </div>
                </section>
                <CommandPreview value={deferredDraft} />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#111c1a] px-6 py-16 text-sand sm:px-10">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sand/42">
                Product framing
              </p>
              <h2 className="mt-4 font-serif text-3xl font-semibold text-sand sm:text-4xl">
                Keep Daytona on the code path, not the infra hop.
              </h2>
              <p className="mt-4 text-sm leading-7 text-sand/68 sm:text-base">
                The worker owns AWS and SSM directly. Daytona only receives the
                log excerpt, repo context, and repair brief, which is the simpler
                shape that actually fits the shared runner constraints.
              </p>
            </div>
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                scrollToSetup();
              }}
              className="inline-flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.18em] text-sand/84 transition hover:text-white"
            >
              Back to setup
              <ArrowDownRight className="h-4 w-4" />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
