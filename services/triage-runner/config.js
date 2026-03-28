function numberFromEnv(name, fallback) {
  const rawValue = String(process.env[name] ?? "").trim();

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }

  return parsed;
}

function booleanFromEnv(name, fallback = false) {
  const rawValue = String(process.env[name] ?? "").trim().toLowerCase();

  if (!rawValue) {
    return fallback;
  }

  if (["true", "1", "yes", "on"].includes(rawValue)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(rawValue)) {
    return false;
  }

  throw new Error(`${name} must be a boolean.`);
}

export function loadRunnerConfig() {
  return {
    idleSleepMs: numberFromEnv("VIBEFIX_RUNNER_IDLE_SLEEP_MS", 5_000),
    ssmPollIntervalMs: numberFromEnv("VIBEFIX_SSM_POLL_INTERVAL_MS", 1_500),
    ssmMaxPollAttempts: numberFromEnv("VIBEFIX_SSM_MAX_POLL_ATTEMPTS", 30),
    ssmDocumentName: String(process.env.VIBEFIX_SSM_DOCUMENT_NAME || "AWS-RunShellScript").trim(),
    openAiModel: String(process.env.VIBEFIX_OPENAI_MODEL || "gpt-5.4").trim(),
    openAiReasoningEffort: String(process.env.VIBEFIX_OPENAI_REASONING_EFFORT || "high").trim(),
    daytonaApiKey: String(process.env.DAYTONA_API_KEY || "").trim(),
    daytonaApiUrl: String(process.env.DAYTONA_API_URL || "https://app.daytona.io/api").trim(),
    daytonaTarget: String(process.env.DAYTONA_TARGET || "").trim() || undefined,
    daytonaLanguage: String(process.env.VIBEFIX_DAYTONA_LANGUAGE || "typescript").trim(),
    daytonaAutoStopInterval: numberFromEnv("VIBEFIX_DAYTONA_AUTO_STOP_MINUTES", 15),
    daytonaNetworkBlockAll: String(process.env.VIBEFIX_DAYTONA_NETWORK_BLOCK_ALL ?? "false")
      .trim()
      .toLowerCase() === "true",
    maxAgentIterations: numberFromEnv("VIBEFIX_MAX_AGENT_ITERATIONS", 12),
    commandTimeoutSeconds: numberFromEnv("VIBEFIX_DAYTONA_COMMAND_TIMEOUT_SECONDS", 30),
    branchPrefix: String(process.env.VIBEFIX_FIX_BRANCH_PREFIX || "vibefix/").trim(),
    gitAuthorName: String(process.env.VIBEFIX_GIT_AUTHOR_NAME || "Vibefix").trim(),
    gitAuthorEmail: String(process.env.VIBEFIX_GIT_AUTHOR_EMAIL || "bot@vibefix.dev").trim(),
    autoDeployAfterFix: booleanFromEnv("VIBEFIX_AUTO_DEPLOY_AFTER_FIX", false),
    deployRepoDir: String(process.env.VIBEFIX_DEPLOY_REPO_DIR || "").trim(),
    deployCommand: String(process.env.VIBEFIX_DEPLOY_COMMAND || "").trim(),
    targetBranchOverride: String(process.env.VIBEFIX_TARGET_BRANCH_OVERRIDE || "").trim(),
    runIntervalSecondsOverride: numberFromEnv("VIBEFIX_RUN_INTERVAL_SECONDS_OVERRIDE", 0),
    dryRun: String(process.env.VIBEFIX_DRY_RUN ?? "false").trim().toLowerCase() === "true",
  };
}
