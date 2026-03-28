import {
  buildCloneCommand,
  buildGitConfigCommand,
  buildResponseCreateParams,
  buildToolDefinitions,
  CONTEXT_ROOT,
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
});
