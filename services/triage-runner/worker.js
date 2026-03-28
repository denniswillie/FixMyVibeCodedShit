import { pool } from "./db.js";
import { loadRunnerConfig } from "./config.js";
import { claimDueAgentConfig, markRunFailed, markRunFinished } from "./repositories/agentConfigs.js";
import { resolveGithubWriteToken } from "./services/githubAccess.js";
import { classifyLogSnippet } from "./services/logClassifier.js";
import { fetchDockerLogs } from "./services/ssmLogProbe.js";
import { runRepairAgent } from "./services/daytonaRepairAgent.js";

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
      skipped: true,
      classifier,
    };
  }

  const githubToken = await resolveGithubWriteToken(claimedConfig);

  if (!githubToken) {
    throw new Error("No GitHub write token available for this user.");
  }

  if (runnerConfig.dryRun) {
    console.log(`[triage-runner] dry-run enabled, skipping Daytona repair launch.`);
    return {
      skipped: true,
      classifier,
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

  return {
    skipped: false,
    classifier,
    repairRun,
  };
}

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

      try {
        await processClaimedConfig(claimedConfig, runnerConfig);
        const markClient = await pool.connect();

        try {
          await markClient.query("begin");
          await markRunFinished(markClient, claimedConfig);
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
          await markRunFailed(markClient, claimedConfig);
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
