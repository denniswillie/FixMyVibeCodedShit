import { runSsmShellCommand } from "./ssmLogProbe.js";

function shellQuote(value) {
  return `'${String(value || "").replace(/'/g, `'\"'\"'`)}'`;
}

export function buildDeployCommand({ repoDir, branch, deployCommand }) {
  if (!repoDir.trim()) {
    throw new Error("Deploy repo dir is required.");
  }

  if (!branch.trim()) {
    throw new Error("Deploy branch is required.");
  }

  if (!deployCommand.trim()) {
    throw new Error("Deploy command is required.");
  }

  return [
    "set -euo pipefail",
    `cd ${shellQuote(repoDir)}`,
    `git fetch origin ${shellQuote(branch)}`,
    `git checkout ${shellQuote(branch)}`,
    `git pull --ff-only origin ${shellQuote(branch)}`,
    deployCommand,
  ].join("\n");
}

export async function deployPushedFix(agentConfig, repairRun, runnerConfig) {
  const branch = String(repairRun?.result?.branch || repairRun?.branchName || "").trim();

  if (!branch) {
    throw new Error("Repair run did not return a deployable branch.");
  }

  const command = buildDeployCommand({
    repoDir: runnerConfig.deployRepoDir,
    branch,
    deployCommand: runnerConfig.deployCommand,
  });

  return runSsmShellCommand(agentConfig, command, runnerConfig);
}
