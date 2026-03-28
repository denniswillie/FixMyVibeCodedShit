import { runSsmShellCommand } from "./ssmLogProbe.js";

function shellQuote(value) {
  return `'${String(value || "").replace(/'/g, `'\"'\"'`)}'`;
}

export function buildDeployCommand({ repoDir, branch, deployCommand, deployUser }) {
  if (!repoDir.trim()) {
    throw new Error("Deploy repo dir is required.");
  }

  if (!branch.trim()) {
    throw new Error("Deploy branch is required.");
  }

  if (!deployCommand.trim()) {
    throw new Error("Deploy command is required.");
  }

  if (!String(deployUser || "").trim()) {
    throw new Error("Deploy user is required.");
  }

  const innerCommand = [
    "set -euo pipefail",
    `cd ${shellQuote(repoDir)}`,
    `git fetch origin ${shellQuote(branch)}`,
    `git checkout ${shellQuote(branch)}`,
    `git pull --ff-only origin ${shellQuote(branch)}`,
    deployCommand,
  ].join("\n");

  return [
    "set -euo pipefail",
    `sudo -u ${shellQuote(deployUser)} -H bash -lc ${shellQuote(innerCommand)}`,
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
    deployUser: runnerConfig.deployUser,
  });

  return runSsmShellCommand(agentConfig, command, runnerConfig);
}
