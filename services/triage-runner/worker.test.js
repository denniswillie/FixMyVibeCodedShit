import { buildRunPayloadFromOutcome, shouldAutoDeployRepairRun } from "./worker.js";

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

  it("auto-deploys a fresh pushed fix", () => {
    expect(
      shouldAutoDeployRepairRun({
        branchName: "master",
        result: {
          decision: "fix_pushed",
          branch: "master",
          commitSha: "abc123",
          pushed: true,
        },
      })
    ).toBe(true);
  });

  it("auto-deploys when the agent identifies a stale deployment on the target branch", () => {
    expect(
      shouldAutoDeployRepairRun({
        branchName: "master",
        result: {
          decision: "needs_human",
          branch: "master",
          commitSha: "3ab9d1e",
          pushed: false,
          summary:
            "The log shows a real runtime failure, but the repository on master already contains the fix.",
          rootCause:
            "The failing service appears to be running code older than current master.",
          fixSummary: "Master already includes the repair and should be redeployed.",
          verification: [
            "Current master already includes the session creation fix, so the next step is operational: confirm the production container/service is running the current commit and redeploy/restart if needed.",
          ],
        },
      })
    ).toBe(true);
  });

  it("does not auto-deploy generic needs_human outcomes without stale-deployment evidence", () => {
    expect(
      shouldAutoDeployRepairRun({
        branchName: "master",
        result: {
          decision: "needs_human",
          branch: "master",
          commitSha: "abc123",
          pushed: false,
          summary: "A real issue was detected, but verification coverage is incomplete.",
          rootCause: "The bug may involve external state.",
          fixSummary: "",
          verification: ["Need access to production-only dependencies."],
        },
      })
    ).toBe(false);
  });
});
