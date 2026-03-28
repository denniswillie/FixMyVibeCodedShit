import {
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
});
