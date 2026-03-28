import type { OnboardingDraft, AuthenticatedUser, GitHubConnection, GitHubRepository } from "@/types/onboarding";

interface ApiErrorShape {
  error?: string;
  message?: string;
}

export interface SessionResponse {
  authenticated: boolean;
  user?: AuthenticatedUser;
}

export interface OnboardingConfigResponse {
  config: OnboardingDraft;
}

export interface GitHubReposResponse {
  connected: boolean;
  connection: GitHubConnection | null;
  repos: GitHubRepository[];
}

export class ApiError extends Error {
  code: string;

  constructor(message: string, code = "api_error") {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    let errorBody: ApiErrorShape = {};

    try {
      errorBody = (await response.json()) as ApiErrorShape;
    } catch {
      errorBody = {};
    }

    throw new ApiError(
      errorBody.message || "Request failed. Please try again.",
      errorBody.error || "api_error"
    );
  }

  return (await response.json()) as T;
}

export async function getSession() {
  return apiRequest<SessionResponse>("/api/auth/session", {
    method: "GET",
  });
}

export async function logout() {
  return apiRequest<{ ok: boolean }>("/api/auth/logout", {
    method: "POST",
  });
}

export async function getOnboardingConfig() {
  return apiRequest<OnboardingConfigResponse>("/api/onboarding/config", {
    method: "GET",
  });
}

export async function saveOnboardingConfig(config: OnboardingDraft) {
  return apiRequest<OnboardingConfigResponse>("/api/onboarding/config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export async function getGithubRepos() {
  return apiRequest<GitHubReposResponse>("/api/github/repos", {
    method: "GET",
  });
}

export function beginGoogleSignIn() {
  window.location.assign("/auth/google");
}

export function beginGithubRepoAccess() {
  window.location.assign("/auth/github");
}
