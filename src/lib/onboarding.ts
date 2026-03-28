import type { OnboardingDraft } from "@/types/onboarding";

export const buildDefaultDraft = (
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
): OnboardingDraft => ({
  github: {
    repoUrl: "",
    branch: "main",
    accessToken: "",
    connection: null,
  },
  aws: {
    accessKeyId: "",
    secretAccessKey: "",
    sessionToken: "",
    region: "eu-west-1",
    instanceId: "i-0abc1234def567890",
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

  if (!draft.github.connection?.installationId && !draft.github.accessToken.trim()) {
    missing.push("GitHub repo access");
  }

  if (!draft.aws.accessKeyId.trim()) {
    missing.push("AWS access key id");
  }

  if (!draft.aws.secretAccessKey.trim()) {
    missing.push("AWS secret access key");
  }

  if (!draft.aws.region.trim()) {
    missing.push("AWS region");
  }

  if (!draft.aws.instanceId.trim()) {
    missing.push("EC2 instance id");
  }

  if (!draft.aws.dockerService.trim()) {
    missing.push("Docker service");
  }

  return missing;
};

export const isDraftReady = (draft: OnboardingDraft) =>
  getMissingFields(draft).length === 0;

export const buildProbeCommand = (draft: OnboardingDraft) =>
  [
    "aws ssm send-command",
    `  --instance-ids ${draft.aws.instanceId || "<instance-id>"}`,
    "  --document-name AWS-RunShellScript",
    `  --parameters commands='docker logs --tail ${draft.aws.logTail || "200"} ${draft.aws.dockerService || "<service>"}'`,
    `  --region ${draft.aws.region || "<region>"}`,
  ].join(" \\\n");

export const buildAgentRunbook = (draft: OnboardingDraft) => [
  `Worker checks the queue every ${draft.schedule.everyMinutes || "15"} minutes.`,
  `Runner uses the uploaded AWS credentials to call SSM against ${draft.aws.instanceId || "the selected EC2 instance"} in ${draft.aws.region || "your AWS region"} and tails ${draft.aws.dockerService || "the selected Docker service"} logs.`,
  draft.github.connection?.installationId
    ? `If errors appear, Vibefix opens a Daytona workspace with GPT-5.4, investigates the repo, and pushes a candidate fix through the connected GitHub App installation on ${draft.github.connection.accountLogin || "your account"}.`
    : "If errors appear, Vibefix opens a Daytona workspace with GPT-5.4, investigates the repo, and prepares a repo fix with the supplied GitHub credential.",
];
