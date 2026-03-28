export interface AuthenticatedUser {
  name?: string;
  email: string;
  company?: string;
  id?: number;
  fullName?: string;
  avatarUrl?: string | null;
  lastLoginProvider?: string | null;
  emailVerifiedAt?: string | null;
  createdAt?: string | null;
}

export interface GitHubConfig {
  repoUrl: string;
  branch: string;
  accessToken: string;
  connection: GitHubConnection | null;
}

export interface GitHubConnection {
  installationId: number;
  accountLogin: string;
  targetType: string;
  repositorySelection: string;
  repoCount: number;
  connectedAt: string | null;
}

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
}

export interface AwsConfig {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region: string;
  instanceId: string;
  dockerService: string;
  logTail: string;
}

export interface ScheduleConfig {
  everyMinutes: string;
  timezone: string;
}

export interface AgentRunUpdate {
  id: string;
  status: "running" | "no_issue" | "needs_human" | "fix_pushed" | "deployed" | "failed";
  classifierReason: string;
  summary: string;
  rootCause: string;
  fixSummary: string;
  patchText: string;
  branch: string;
  commitSha: string;
  pushed: boolean;
  deployed: boolean;
  errorMessage: string;
  startedAt: string | null;
  finishedAt: string | null;
  deployedAt: string | null;
  createdAt: string | null;
}

export interface OnboardingDraft {
  github: GitHubConfig;
  aws: AwsConfig;
  schedule: ScheduleConfig;
}
