import { buildRunPayloadFromOutcome } from "./worker.js";

describe("worker", () => {
  it("preserves the repair-agent explanation for no_issue outcomes", () => {
    const payload = buildRunPayloadFromOutcome({
      outcome: "no_issue",
      classifier: {
        reason: "actionable_error_detected",
        matchedPatterns: ["error"],
      },
      logSnippet: "[auth] login failed",
      repairRun: {
        branchName: "master",
        patchText: "",
        result: {
          decision: "no_issue",
          summary: "The logs were expected for this deployment window.",
          rootCause: "Known rollout noise.",
          fixSummary: "",
          verification: ["Reviewed deployment logs"],
          branch: "master",
          commitSha: "",
          pushed: false,
        },
      },
    });

    expect(payload.status).toBe("no_issue");
    expect(payload.summary).toBe("The logs were expected for this deployment window.");
    expect(payload.rootCause).toBe("Known rollout noise.");
    expect(payload.verification).toEqual(["Reviewed deployment logs"]);
  });
});
