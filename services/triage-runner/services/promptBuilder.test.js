import { buildRepairPrompt } from "./promptBuilder.js";

describe("promptBuilder", () => {
  it("includes repo, branch, logs, and final JSON instructions", () => {
    const prompt = buildRepairPrompt({
      claimedConfig: {
        github: {
          repoUrl: "https://github.com/acme/api",
          branch: "main",
        },
        aws: {
          instanceId: "i-0abc1234def567890",
          region: "eu-west-1",
          dockerService: "web",
        },
      },
      branchName: "vibefix/triage-7-1234567890",
      logSnippet: "[error] checkout 500",
      classifier: {
        reason: "actionable_error_detected",
        matchedPatterns: ["error"],
      },
      pollTimestamp: "2026-03-28T15:00:00.000Z",
    });

    expect(prompt).toContain("https://github.com/acme/api");
    expect(prompt).toContain("vibefix/triage-7-1234567890");
    expect(prompt).toContain("[error] checkout 500");
    expect(prompt).toContain("\"decision\": \"no_issue\" | \"needs_human\" | \"fix_pushed\"");
  });
});
