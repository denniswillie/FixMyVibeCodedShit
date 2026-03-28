import {
  buildObservedPushResult,
  buildCloneCommand,
  buildExhaustedIterationsResult,
  buildGitConfigCommand,
  buildRepoStateCommand,
  buildResponseCreateParams,
  buildToolDefinitions,
  CONTEXT_ROOT,
  hasCriticalRuntimeFailure,
  normalizeRepairResult,
  parseRepoStateOutput,
  REPO_ROOT,
  SANDBOX_HOME,
  runSandboxCommand,
} from "./daytonaRepairAgent.js";

describe("daytonaRepairAgent", () => {
  it("uses a writable home directory inside the sandbox", () => {
    expect(SANDBOX_HOME).toBe("/home/daytona");
    expect(REPO_ROOT).toBe("/home/daytona/repo");
    expect(CONTEXT_ROOT).toBe("/home/daytona/context");
  });

  it("throws when a setup command exits nonzero", async () => {
    const sandbox = {
      process: {
        executeCommand: vi.fn().mockResolvedValue({
          exitCode: 1,
          result: "",
          artifacts: {
            stderr: "permission denied",
          },
        }),
      },
    };

    await expect(
      runSandboxCommand(sandbox, "mkdir -p /bad/path", undefined, 30)
    ).rejects.toThrow(/permission denied/i);
  });

  it("defines run_command with a strict-compatible required list", () => {
    const runCommandTool = buildToolDefinitions().find((tool) => tool.name === "run_command");

    expect(runCommandTool.parameters.required).toEqual([
      "command",
      "cwd",
      "timeoutSeconds",
    ]);
    expect(runCommandTool.parameters.properties.cwd.type).toEqual(["string", "null"]);
    expect(runCommandTool.parameters.properties.timeoutSeconds.type).toEqual([
      "integer",
      "null",
    ]);
  });

  it("stores responses when chaining with previous_response_id", () => {
    const params = buildResponseCreateParams({
      input: "test prompt",
      model: "gpt-5.4",
      previousResponseId: "resp_123",
      reasoningEffort: "high",
      tools: buildToolDefinitions(),
    });

    expect(params.store).toBe(true);
    expect(params.previous_response_id).toBe("resp_123");
    expect(params.reasoning).toEqual({ effort: "high" });
  });

  it("clones only the target branch in a fresh sandbox", () => {
    const command = buildCloneCommand("https://example.com/private.git", "master");

    expect(command).toContain("git clone");
    expect(command).toContain("--depth 1");
    expect(command).toContain("--single-branch");
    expect(command).toContain("--branch 'master'");
    expect(command).toContain("'https://example.com/private.git'");
    expect(command).toContain("'/home/daytona/repo'");
  });

  it("quotes git identity config safely", () => {
    const command = buildGitConfigCommand({
      gitAuthorEmail: "bot@vibefix.dev",
      gitAuthorName: "Vibefix Bot",
    });

    expect(command).toContain("config user.name 'Vibefix Bot'");
    expect(command).toContain("config user.email 'bot@vibefix.dev'");
    expect(command).toContain("'/home/daytona/repo'");
  });

  it("recognizes critical runtime failures in production logs", () => {
    expect(
      hasCriticalRuntimeFailure(`
        [auth] loginWithGoogleProfile failed: TypeError: Cannot read properties of undefined
            at createSessionForUser (/usr/src/app/services/sessionService.js:120:28)
      `)
    ).toBe(true);
  });

  it("upgrades actionable no_issue decisions to needs_human for runtime exceptions", () => {
    const normalized = normalizeRepairResult(
      {
        decision: "no_issue",
        confidence: 0.91,
        summary: "",
        rootCause: "",
        fixSummary: "",
        verification: [],
        branch: "master",
        commitSha: "",
        pushed: false,
      },
      "master",
      {
        reason: "actionable_error_detected",
        matchedPatterns: ["error"],
      },
      `
        [auth] loginWithGoogleProfile failed: TypeError: Cannot read properties of undefined
            at createSessionForUser (/usr/src/app/services/sessionService.js:120:28)
      `
    );

    expect(normalized.decision).toBe("needs_human");
    expect(normalized.pushed).toBe(false);
    expect(normalized.summary).toMatch(/runtime exception/i);
  });

  it("returns a non-crashing needs_human fallback when the tool loop exhausts", () => {
    const result = buildExhaustedIterationsResult({
      targetBranch: "master",
      logSnippet: `
        [auth] loginWithGoogleProfile failed: TypeError: Cannot read properties of undefined
            at createSessionForUser (/usr/src/app/services/sessionService.js:120:28)
      `,
      toolNames: ["run_command", "read_file"],
    });

    expect(result.decision).toBe("needs_human");
    expect(result.branch).toBe("master");
    expect(result.pushed).toBe(false);
    expect(result.summary).toMatch(/real production exception/i);
    expect(result.verification[0]).toMatch(/run_command, read_file/);
  });

  it("parses repo-state command output", () => {
    expect(
      parseRepoStateOutput(
        "abc123\nFix login crash\nVibefix\nbot@vibefix.dev\nabc123\n"
      )
    ).toEqual({
      headSha: "abc123",
      subject: "Fix login crash",
      authorName: "Vibefix",
      authorEmail: "bot@vibefix.dev",
      remoteHeadSha: "abc123",
    });
  });

  it("builds a repo-state command that checks remote branch head", () => {
    const command = buildRepoStateCommand("master");

    expect(command).toContain("ls-remote origin");
    expect(command).toContain("refs/heads/master");
    expect(command).toContain("/home/daytona/repo");
  });

  it("promotes a bot-authored remote head advance into fix_pushed", () => {
    const promoted = buildObservedPushResult({
      initialHead: "old123",
      logSnippet:
        "[auth] loginWithGoogleProfile failed: TypeError: Cannot read properties of undefined",
      normalizedResult: {
        decision: "needs_human",
        confidence: 0.4,
        summary: "",
        rootCause: "",
        fixSummary: "",
        verification: ["Read the auth stack trace."],
      },
      repoState: {
        headSha: "new456",
        subject: "Fix Google sign-in session creation crash",
        authorName: "Vibefix",
        authorEmail: "bot@vibefix.dev",
        remoteHeadSha: "new456",
      },
      runnerConfig: {
        gitAuthorName: "Vibefix",
        gitAuthorEmail: "bot@vibefix.dev",
      },
      targetBranch: "master",
    });

    expect(promoted).toMatchObject({
      decision: "fix_pushed",
      branch: "master",
      commitSha: "new456",
      pushed: true,
    });
    expect(promoted.verification).toContain(
      "Observed master advancing to new456 during the Daytona repair run."
    );
  });
});
