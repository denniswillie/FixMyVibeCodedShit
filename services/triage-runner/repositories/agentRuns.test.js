import { createAgentRun, finishAgentRun } from "./agentRuns.js";

describe("agentRuns repository", () => {
  it("creates a running row for a claimed config", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: "run_123" }],
      }),
    };

    const result = await createAgentRun(client, {
      id: "cfg_123",
      userId: 7,
    });

    expect(result).toBe("run_123");
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("insert into public.agent_runs"),
      ["cfg_123", 7]
    );
  });

  it("finishes a run with persisted result details", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    await finishAgentRun(client, "run_123", {
      status: "deployed",
      classifierReason: "actionable_error_detected",
      matchedPatterns: ["error", "exception"],
      logExcerpt: "[error] checkout 500",
      summary: "Patched and redeployed.",
      rootCause: "Null checkout payload",
      fixSummary: "Added a guard",
      patchText: "diff --git a/app.js b/app.js",
      verification: ["npm test"],
      branch: "master",
      commitSha: "abc123",
      pushed: true,
      deployed: true,
      deployedAt: "2026-03-28T15:10:00.000Z",
      errorMessage: "",
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("update public.agent_runs"),
      [
        "run_123",
        "deployed",
        "actionable_error_detected",
        JSON.stringify(["error", "exception"]),
        "[error] checkout 500",
        "Patched and redeployed.",
        "Null checkout payload",
        "Added a guard",
        "diff --git a/app.js b/app.js",
        JSON.stringify(["npm test"]),
        "master",
        "abc123",
        true,
        true,
        "2026-03-28T15:10:00.000Z",
        "",
      ]
    );
  });
});
