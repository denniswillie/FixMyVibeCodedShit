import type { OnboardingDraft } from "@/types/onboarding";

export const buildDefaultDraft = (
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
): OnboardingDraft => ({
  github: {
    repoUrl: "https://github.com/acme/fragile-launch",
    branch: "main",
    accessToken: "",
    connection: null,
  },
  ssh: {
    host: "ec2-12-34-56-78.compute.amazonaws.com",
    port: "22",
    username: "ubuntu",
    privateKey: "",
    dockerService: "web",
    logTail: "200",
  },
  schedule: {
    everyMinutes: "15",
    timezone,
  },
});

export const getMissingFields = (draft: OnboardingDraft) => {
  const missing: string[] = [];

  if (!draft.github.repoUrl.trim()) {
    missing.push("GitHub repo URL");
  }

  if (!draft.github.connection?.installationId && !draft.github.accessToken.trim()) {
    missing.push("GitHub repo access");
  }

  if (!draft.ssh.host.trim()) {
    missing.push("EC2 host");
  }

  if (!draft.ssh.privateKey.trim()) {
    missing.push("SSH private key");
  }

  if (!draft.ssh.dockerService.trim()) {
    missing.push("Docker service");
  }

  return missing;
};

export const isDraftReady = (draft: OnboardingDraft) =>
  getMissingFields(draft).length === 0;

export const buildShellCommand = (draft: OnboardingDraft) =>
  [
    `ssh -p ${draft.ssh.port || "22"} ${draft.ssh.username || "ubuntu"}@${draft.ssh.host || "<host>"}`,
    `docker logs --tail ${draft.ssh.logTail || "200"} ${draft.ssh.dockerService || "<service>"}`,
  ].join(" && ");

export const buildAgentRunbook = (draft: OnboardingDraft) => [
  `Worker checks the queue every ${draft.schedule.everyMinutes || "15"} minutes.`,
  `Runner opens an SSH session to ${draft.ssh.host || "your EC2 host"} and tails ${draft.ssh.dockerService || "the selected Docker service"} logs.`,
  draft.github.connection?.installationId
    ? `If errors appear, Vibefix opens a Daytona workspace with GPT-5.4 and pushes the fix through the connected GitHub App installation on ${draft.github.connection.accountLogin || "your account"}.`
    : "If errors appear, Vibefix opens a Daytona workspace with GPT-5.4, patches the repo, and pushes a manual deployment fix.",
];
