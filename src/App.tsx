import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { ArrowDownRight, Github, Server, WandSparkles } from "lucide-react";

import { CommandPreview } from "@/components/CommandPreview";
import { CredentialsForm } from "@/components/CredentialsForm";
import { DemoAuthPanel } from "@/components/DemoAuthPanel";
import { HeroScene } from "@/components/HeroScene";
import { buildDefaultDraft, isDraftReady } from "@/lib/onboarding";
import {
  ApiError,
  beginGithubRepoAccess,
  beginGoogleSignIn,
  getOnboardingConfig,
  getSession,
  logout,
  saveOnboardingConfig,
} from "@/lib/websiteApi";
import type { AuthenticatedUser, OnboardingDraft } from "@/types/onboarding";

const operators = [
  {
    icon: Server,
    title: "Read the real box",
    body: "This demo operator connects over SSH and reads the Docker service you choose instead of guessing from synthetic health checks.",
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

const App = () => {
  const setupRef = useRef<HTMLElement>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [draft, setDraft] = useState<OnboardingDraft>(() => buildDefaultDraft());
  const [authLoading, setAuthLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const deferredDraft = useDeferredValue(draft);

  const scrollToSetup = () => {
    const setupElement = setupRef.current;
    if (setupElement && typeof setupElement.scrollIntoView === "function") {
      setupElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

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
          setMessage("GitHub repo access connected. Finish the EC2 details and save the operator config.");
        } else if (authError) {
          setMessage(`Google sign-in failed: ${authError.split("_").join(" ")}.`);
        } else if (githubError) {
          setMessage(`GitHub connect failed: ${githubError.split("_").join(" ")}.`);
        }

        if (!session.authenticated || !session.user) {
          startTransition(() => {
            setUser(null);
            setDraft(buildDefaultDraft());
          });
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
          setDraft({
            github: {
              ...onboarding.config.github,
              branch: String(onboarding.config.github.branch),
              accessToken: String(onboarding.config.github.accessToken),
              repoUrl: String(onboarding.config.github.repoUrl),
              connection: onboarding.config.github.connection
                ? {
                    ...onboarding.config.github.connection,
                    installationId: Number(onboarding.config.github.connection.installationId),
                    repoCount: Number(onboarding.config.github.connection.repoCount),
                    connectedAt: onboarding.config.github.connection.connectedAt,
                  }
                : null,
            },
            ssh: {
              ...onboarding.config.ssh,
              host: String(onboarding.config.ssh.host),
              port: String(onboarding.config.ssh.port),
              username: String(onboarding.config.ssh.username),
              privateKey: String(onboarding.config.ssh.privateKey),
              dockerService: String(onboarding.config.ssh.dockerService),
              logTail: String(onboarding.config.ssh.logTail),
            },
            schedule: {
              everyMinutes: String(onboarding.config.schedule.everyMinutes),
              timezone: String(onboarding.config.schedule.timezone),
            },
          });
        });
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
        if (authStatus || authError || githubStatus || githubError) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    };

    void bootstrap();

    return () => {
      isActive = false;
    };
  }, []);

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
    });
    setSaveState("idle");
    setMessage("Signed out. Sign in again to continue configuring the operator.");
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
        setDraft({
          github: {
            ...result.config.github,
            repoUrl: String(result.config.github.repoUrl),
            branch: String(result.config.github.branch),
            accessToken: String(result.config.github.accessToken),
            connection: result.config.github.connection
              ? {
                  ...result.config.github.connection,
                  installationId: Number(result.config.github.connection.installationId),
                  repoCount: Number(result.config.github.connection.repoCount),
                  connectedAt: result.config.github.connection.connectedAt,
                }
              : null,
          },
          ssh: {
            ...result.config.ssh,
            host: String(result.config.ssh.host),
            port: String(result.config.ssh.port),
            username: String(result.config.ssh.username),
            privateKey: String(result.config.ssh.privateKey),
            dockerService: String(result.config.ssh.dockerService),
            logTail: String(result.config.ssh.logTail),
          },
          schedule: {
            everyMinutes: String(result.config.schedule.everyMinutes),
            timezone: String(result.config.schedule.timezone),
          },
        });
      });
      setSaveState("saved");
      setMessage("Operator credentials saved. The worker can pick this user up on the next run.");
    } catch (error) {
      setSaveState("error");
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to save the operator settings right now."
      );
    }
  };

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
                write-back. EC2 SSH grants log access. The worker can turn the
                cadence fields into a future `scheduled_run_time` job without
                changing the website model.
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
                For the demo, skip AWS keys and stay brutally literal.
              </h2>
              <p className="mt-4 text-sm leading-7 text-sand/68 sm:text-base">
                If the agent is just SSHing to one known EC2 instance and running
                `docker logs`, the website should ask for SSH details only. Add
                AWS IAM later when you need discovery, SSM, or infrastructure
                automation.
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
