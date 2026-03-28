import { pool } from "./db.js";
import { loadRunnerConfig } from "./config.js";
import { claimDueAgentConfig, markRunFailed, markRunFinished } from "./repositories/agentConfigs.js";
import { createAgentRun, finishAgentRun } from "./repositories/agentRuns.js";
import { deployPushedFix } from "./services/deployService.js";
import { resolveGithubWriteToken } from "./services/githubAccess.js";
import { classifyLogSnippet } from "./services/logClassifier.js";
import { fetchDockerLogs } from "./services/ssmLogProbe.js";
import { runRepairAgent } from "./services/daytonaRepairAgent.js";

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const STALE_DEPLOYMENT_PATTERNS = [
  /\balready contains the fix\b/i,
  /\brunning code older than current\b/i,
  /\bstale container\b/i,
  /\bstale deployment\b/i,
  /\bredeploy(?:ed|ment)?\b/i,
  /\brunning service\/log source is not on the current master commit\b/i,
  /\bservice appears to be running code older than current master\b/i,
];

function shouldAutoDeployRepairRun(repairRun) {
  const decision = String(repairRun?.result?.decision || "").trim();
  const pushed = Boolean(repairRun?.result?.pushed);
  const branch = String(repairRun?.result?.branch || repairRun?.branchName || "").trim();
  const commitSha = String(repairRun?.result?.commitSha || "").trim();

  if (!branch || !commitSha) {
    return false;
  }

  if (decision === "fix_pushed" && pushed) {
    return true;
  }

  if (decision !== "needs_human") {
    return false;
  }

  const explanation = [
    repairRun?.result?.summary,
    repairRun?.result?.rootCause,
    repairRun?.result?.fixSummary,
    ...(Array.isArray(repairRun?.result?.verification) ? repairRun.result.verification : []),
  ]
    .filter(Boolean)
    .join("\n");

  return STALE_DEPLOYMENT_PATTERNS.some((pattern) => pattern.test(explanation));
}

async function processClaimedConfig(claimedConfig, runnerConfig) {
  const logs = await fetchDockerLogs(claimedConfig, runnerConfig);
  const logSnippet = `${logs.stdout}\n${logs.stderr}`.trim();
  console.log(`[triage-runner] user=${claimedConfig.userId} logs:\n${logSnippet || "(empty)"}`);
  const classifier = classifyLogSnippet(logSnippet);

  if (!classifier.shouldInvestigate) {
    console.log(
      `[triage-runner] user=${claimedConfig.userId} no actionable issue (${classifier.reason})`
    );
    return {
      outcome: "no_issue",
      classifier,
      logSnippet,
    };
  }

  const githubToken = await resolveGithubWriteToken(claimedConfig);

  if (!githubToken) {
    throw new Error("No GitHub write token available for this user.");
  }

  if (runnerConfig.dryRun) {
    console.log(`[triage-runner] dry-run enabled, skipping Daytona repair launch.`);
    return {
      outcome: "needs_human",
      classifier,
      logSnippet,
      summary: "Actionable logs detected, but dry-run mode prevented an automated fix.",
    };
  }

  const repairRun = await runRepairAgent({
    claimedConfig,
    githubToken,
    logSnippet,
    classifier,
    runnerConfig,
  });

  console.log(
    `[triage-runner] user=${claimedConfig.userId} decision=${repairRun.result.decision} confidence=${repairRun.result.confidence}`
  );

  if (runnerConfig.autoDeployAfterFix && shouldAutoDeployRepairRun(repairRun)) {
    try {
      const deployResult = await deployPushedFix(claimedConfig, repairRun, runnerConfig);
      console.log(
        `[triage-runner] user=${claimedConfig.userId} deployed branch=${repairRun.result.branch || repairRun.branchName} via SSM command ${deployResult.commandId}`
      );

      return {
        outcome: "deployed",
        classifier,
        logSnippet,
        repairRun,
        deployResult,
      };
    } catch (error) {
      return {
        outcome: "failed",
        classifier,
        logSnippet,
        repairRun,
        error,
      };
    }
  }

  return {
    outcome: repairRun.result.decision,
    classifier,
    logSnippet,
    repairRun,
  };
}

function buildRunPayloadFromOutcome(processedResult) {
  const classifier = processedResult?.classifier || {
    reason: "",
    matchedPatterns: [],
  };
  const basePayload = {
    classifierReason: classifier.reason,
    matchedPatterns: classifier.matchedPatterns || [],
    logExcerpt: processedResult?.logSnippet || "",
    summary: "",
    rootCause: "",
    fixSummary: "",
    patchText: "",
    verification: [],
    branch: "",
    commitSha: "",
    pushed: false,
    deployed: false,
    deployedAt: null,
    errorMessage: "",
  };

  if (processedResult.outcome === "no_issue") {
    return {
      status: "no_issue",
      ...basePayload,
      summary:
        processedResult.repairRun?.result?.summary ||
        "Latest logs looked healthy enough to skip an automated repair run.",
      rootCause: processedResult.repairRun?.result?.rootCause || "",
      fixSummary: processedResult.repairRun?.result?.fixSummary || "",
      patchText: processedResult.repairRun?.patchText || "",
      verification: processedResult.repairRun?.result?.verification || [],
      branch: processedResult.repairRun?.result?.branch || processedResult.repairRun?.branchName || "",
      commitSha: processedResult.repairRun?.result?.commitSha || "",
      pushed: Boolean(processedResult.repairRun?.result?.pushed),
    };
  }

  if (processedResult.outcome === "needs_human") {
    return {
      status: "needs_human",
      ...basePayload,
      summary:
        processedResult.summary ||
        processedResult.repairRun?.result?.summary ||
        "A real issue was detected, but Vibefix did not have enough confidence to ship a fix.",
      rootCause: processedResult.repairRun?.result?.rootCause || "",
      fixSummary: processedResult.repairRun?.result?.fixSummary || "",
      patchText: processedResult.repairRun?.patchText || "",
      verification: processedResult.repairRun?.result?.verification || [],
      branch: processedResult.repairRun?.result?.branch || processedResult.repairRun?.branchName || "",
      commitSha: processedResult.repairRun?.result?.commitSha || "",
      pushed: Boolean(processedResult.repairRun?.result?.pushed),
    };
  }

  if (processedResult.outcome === "fix_pushed" || processedResult.outcome === "deployed") {
    return {
      status: processedResult.outcome,
      ...basePayload,
      summary:
        processedResult.repairRun?.result?.summary ||
        (processedResult.outcome === "deployed"
          ? "Vibefix pushed a repair and deployed it successfully."
          : "Vibefix pushed a repair directly to the target branch."),
      rootCause: processedResult.repairRun?.result?.rootCause || "",
      fixSummary: processedResult.repairRun?.result?.fixSummary || "",
      patchText: processedResult.repairRun?.patchText || "",
      verification: processedResult.repairRun?.result?.verification || [],
      branch: processedResult.repairRun?.result?.branch || processedResult.repairRun?.branchName || "",
      commitSha: processedResult.repairRun?.result?.commitSha || "",
      pushed: Boolean(processedResult.repairRun?.result?.pushed),
      deployed: processedResult.outcome === "deployed",
      deployedAt: processedResult.outcome === "deployed" ? new Date().toISOString() : null,
    };
  }

  return {
    status: "failed",
    ...basePayload,
    summary:
      processedResult?.repairRun?.result?.summary ||
      "The triage run failed before Vibefix could finish a safe repair cycle.",
    rootCause: processedResult?.repairRun?.result?.rootCause || "",
    fixSummary: processedResult?.repairRun?.result?.fixSummary || "",
    patchText: processedResult?.repairRun?.patchText || "",
    verification: processedResult?.repairRun?.result?.verification || [],
    branch: processedResult?.repairRun?.result?.branch || processedResult?.repairRun?.branchName || "",
    commitSha: processedResult?.repairRun?.result?.commitSha || "",
    pushed: Boolean(processedResult?.repairRun?.result?.pushed),
    errorMessage: String(processedResult?.error?.message || processedResult?.error || ""),
  };
}

export { buildRunPayloadFromOutcome, shouldAutoDeployRepairRun };

export async function runForever() {
  const runnerConfig = loadRunnerConfig();
  let shouldStop = false;

  const stop = () => {
    shouldStop = true;
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!shouldStop) {
    const client = await pool.connect();

    try {
      await client.query("begin");
      const claimedConfig = await claimDueAgentConfig(client);

      if (!claimedConfig) {
        await client.query("rollback");
        await sleep(runnerConfig.idleSleepMs);
        continue;
      }

      await client.query("commit");
      let runId = "";

      try {
        const runClient = await pool.connect();

        try {
          await runClient.query("begin");
          runId = await createAgentRun(runClient, claimedConfig);
          await runClient.query("commit");
        } catch (error) {
          await runClient.query("rollback").catch(() => {});
          throw error;
        } finally {
          runClient.release();
        }

        const processedResult = await processClaimedConfig(claimedConfig, runnerConfig);
        const markClient = await pool.connect();

        try {
          await markClient.query("begin");
          await finishAgentRun(markClient, runId, buildRunPayloadFromOutcome(processedResult));
          await markRunFinished(markClient, claimedConfig, "active", {
            runIntervalSecondsOverride: runnerConfig.runIntervalSecondsOverride,
          });
          await markClient.query("commit");
        } catch (error) {
          await markClient.query("rollback");
          throw error;
        } finally {
          markClient.release();
        }
      } catch (error) {
        console.error(`[triage-runner] user=${claimedConfig.userId} run failed:`, error);
        const markClient = await pool.connect();

        try {
          await markClient.query("begin");
          if (runId) {
            await finishAgentRun(markClient, runId, {
              status: "failed",
              classifierReason: "",
              matchedPatterns: [],
              logExcerpt: "",
              summary: "The triage run crashed before it could finish.",
              rootCause: "",
              fixSummary: "",
              patchText: "",
              verification: [],
              branch: "",
              commitSha: "",
              pushed: false,
              deployed: false,
              deployedAt: null,
              errorMessage: error instanceof Error ? error.message : String(error),
            });
          }
          await markRunFailed(markClient, claimedConfig, {
            runIntervalSecondsOverride: runnerConfig.runIntervalSecondsOverride,
          });
          await markClient.query("commit");
        } catch (markError) {
          await markClient.query("rollback");
          console.error(`[triage-runner] failed to mark run failure:`, markError);
        } finally {
          markClient.release();
        }
      }
    } catch (error) {
      await client.query("rollback").catch(() => {});
      console.error("[triage-runner] claim loop failed:", error);
      await sleep(runnerConfig.idleSleepMs);
    } finally {
      client.release();
    }
  }

  process.off("SIGINT", stop);
  process.off("SIGTERM", stop);
}
