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

export interface SshConfig {
  host: string;
  port: string;
  username: string;
  privateKey: string;
  dockerService: string;
  logTail: string;
}

export interface ScheduleConfig {
  everyMinutes: string;
  timezone: string;
}

export interface OnboardingDraft {
  github: GitHubConfig;
  ssh: SshConfig;
  schedule: ScheduleConfig;
}
