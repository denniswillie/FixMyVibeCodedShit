import { Daytona } from "@daytonaio/sdk";
import OpenAI from "openai";

import { buildAuthenticatedRepoUrl, parseGithubRepoUrl } from "./githubAccess.js";
import { buildRepairPrompt } from "./promptBuilder.js";

const SANDBOX_HOME = "/home/daytona";
const REPO_ROOT = `${SANDBOX_HOME}/repo`;
const CONTEXT_ROOT = `${SANDBOX_HOME}/context`;
const PATCH_PATH = `${CONTEXT_ROOT}/fix.patch`;

function truncateResult(value, limit = 12_000) {
  const text = String(value || "");

  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit)}\n...[truncated ${text.length - limit} chars]`;
}

function buildToolDefinitions() {
  return [
    {
      type: "function",
      name: "run_command",
      description: "Run a shell command inside the Daytona sandbox and return stdout, stderr, and exit code.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          command: {
            type: "string",
            description: "Shell command to execute.",
          },
          cwd: {
            type: ["string", "null"],
            description: "Absolute working directory. Use null to default to /home/daytona/repo.",
          },
          timeoutSeconds: {
            type: ["integer", "null"],
            description: "Timeout in seconds for the command. Use null to default to the runner timeout.",
          },
        },
        required: ["command", "cwd", "timeoutSeconds"],
      },
    },
    {
      type: "function",
      name: "read_file",
      description: "Read a text file from the Daytona sandbox.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: {
            type: "string",
            description: "Absolute path to the file to read.",
          },
        },
        required: ["path"],
      },
    },
    {
      type: "function",
      name: "write_file",
      description: "Write or overwrite a text file inside the Daytona sandbox.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: {
            type: "string",
            description: "Absolute file path inside the sandbox.",
          },
          content: {
            type: "string",
            description: "Full file contents to write.",
          },
        },
        required: ["path", "content"],
      },
    },
  ];
}

function buildResponseCreateParams({
  input,
  model,
  previousResponseId,
  reasoningEffort,
  tools,
}) {
  return {
    model,
    input,
    ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
    reasoning: {
      effort: reasoningEffort,
    },
    // We rely on previous_response_id for the tool loop, so these responses
    // must remain addressable until the loop completes.
    store: true,
    tools,
  };
}

function extractToolCalls(response) {
  return Array.isArray(response.output)
    ? response.output.filter((item) => item.type === "function_call")
    : [];
}

function parseJsonResponse(outputText) {
  const rawText = String(outputText || "").trim();
  const jsonStart = rawText.indexOf("{");
  const jsonEnd = rawText.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`Expected JSON final response, received: ${rawText}`);
  }

  return JSON.parse(rawText.slice(jsonStart, jsonEnd + 1));
}

function normalizeRepairResult(result, targetBranch) {
  const normalized = {
    ...result,
    branch: String(result?.branch || targetBranch).trim() || targetBranch,
    commitSha: String(result?.commitSha || "").trim(),
    pushed: Boolean(result?.pushed),
    verification: Array.isArray(result?.verification) ? result.verification : [],
  };

  if (normalized.decision === "fix_pushed") {
    if (normalized.branch !== targetBranch) {
      throw new Error(`Repair agent pushed to ${normalized.branch}, expected ${targetBranch}.`);
    }

    if (!normalized.pushed || !normalized.commitSha) {
      throw new Error("Repair agent reported fix_pushed without a pushed commit SHA.");
    }
  }

  return normalized;
}

function getExecutionOutput(execution) {
  return String(execution?.result || execution?.artifacts?.stdout || "").trim();
}

function getExecutionError(execution) {
  return String(execution?.artifacts?.stderr || "").trim();
}

async function runSandboxCommand(sandbox, command, cwd, timeoutSeconds) {
  const execution = await sandbox.process.executeCommand(
    command,
    cwd,
    undefined,
    timeoutSeconds
  );

  if (Number(execution?.exitCode || 0) !== 0) {
    throw new Error(
      `Sandbox command failed (${command}): ${getExecutionError(execution) || getExecutionOutput(execution) || `exit ${execution.exitCode}`}`
    );
  }

  return execution;
}

async function collectFixArtifacts(sandbox, targetBranch, timeoutSeconds) {
  const headSha = await runSandboxCommand(
    sandbox,
    `git -C ${REPO_ROOT} rev-parse HEAD`,
    undefined,
    timeoutSeconds
  );
  const commitSha = getExecutionOutput(headSha);

  if (!commitSha) {
    throw new Error("Unable to resolve HEAD after the repair push.");
  }

  await runSandboxCommand(
    sandbox,
    `git -C ${REPO_ROOT} format-patch -1 --stdout HEAD > ${PATCH_PATH}`,
    undefined,
    timeoutSeconds
  );

  const patchBuffer = await sandbox.fs.downloadFile(PATCH_PATH);
  const patchText = patchBuffer.toString();

  if (!patchText.trim()) {
    throw new Error("Generated patch artifact was empty.");
  }

  return {
    branch: targetBranch,
    commitSha,
    patchText,
  };
}

export async function runRepairAgent({
  claimedConfig,
  githubToken,
  logSnippet,
  classifier,
  runnerConfig,
}) {
  const daytona = new Daytona({
    apiKey: runnerConfig.daytonaApiKey,
    apiUrl: runnerConfig.daytonaApiUrl,
    ...(runnerConfig.daytonaTarget ? { target: runnerConfig.daytonaTarget } : {}),
  });
  const openai = new OpenAI();
  const { owner, repo } = parseGithubRepoUrl(claimedConfig.github.repoUrl);
  const targetBranch =
    String(runnerConfig.targetBranchOverride || claimedConfig.github.branch || "main").trim() ||
    "main";
  const repoCloneUrl = buildAuthenticatedRepoUrl(claimedConfig.github.repoUrl, githubToken);
  const sandbox = await daytona.create({
    language: runnerConfig.daytonaLanguage,
    autoStopInterval: runnerConfig.daytonaAutoStopInterval,
    envVars: {
      VIBEFIX_TARGET_BRANCH: targetBranch,
      VIBEFIX_REPO_OWNER: owner,
      VIBEFIX_REPO_NAME: repo,
    },
    ...(runnerConfig.daytonaNetworkBlockAll ? { networkBlockAll: true } : {}),
  });

  try {
    await runSandboxCommand(
      sandbox,
      `mkdir -p ${CONTEXT_ROOT}`,
      undefined,
      runnerConfig.commandTimeoutSeconds
    );
    await runSandboxCommand(
      sandbox,
      `git clone ${repoCloneUrl} ${REPO_ROOT}`,
      undefined,
      runnerConfig.commandTimeoutSeconds
    );
    await runSandboxCommand(
      sandbox,
      `git -C ${REPO_ROOT} checkout ${targetBranch}`,
      undefined,
      runnerConfig.commandTimeoutSeconds
    );
    await runSandboxCommand(
      sandbox,
      `git -C ${REPO_ROOT} pull --ff-only origin ${targetBranch}`,
      undefined,
      runnerConfig.commandTimeoutSeconds
    );
    await runSandboxCommand(
      sandbox,
      `git -C ${REPO_ROOT} config user.name "${runnerConfig.gitAuthorName}" && git -C ${REPO_ROOT} config user.email "${runnerConfig.gitAuthorEmail}"`,
      undefined,
      runnerConfig.commandTimeoutSeconds
    );
    await sandbox.fs.uploadFiles([
      {
        source: Buffer.from(logSnippet),
        destination: `${CONTEXT_ROOT}/log-snippet.txt`,
      },
      {
        source: Buffer.from(
          JSON.stringify(
            {
              claimedConfig,
              classifier,
              pollTimestamp: new Date().toISOString(),
              targetBranch,
            },
            null,
            2
          )
        ),
        destination: `${CONTEXT_ROOT}/triage-context.json`,
      },
    ]);

    const prompt = buildRepairPrompt({
      claimedConfig,
      branchName: targetBranch,
      logSnippet,
      classifier,
      pollTimestamp: new Date().toISOString(),
    });

    const tools = buildToolDefinitions();
    let previousResponseId;
    let pendingInputs = prompt;
    let finalText = "";

    for (let iteration = 0; iteration < runnerConfig.maxAgentIterations; iteration += 1) {
      const response = await openai.responses.create(
        buildResponseCreateParams({
          input: pendingInputs,
          model: runnerConfig.openAiModel,
          previousResponseId,
          reasoningEffort: runnerConfig.openAiReasoningEffort,
          tools,
        })
      );

      previousResponseId = response.id;
      const toolCalls = extractToolCalls(response);

      if (!toolCalls.length) {
        finalText = response.output_text || "";
        break;
      }

      const toolOutputs = [];

      for (const call of toolCalls) {
        const args = JSON.parse(call.arguments || "{}");

        if (call.name === "run_command") {
          const execution = await sandbox.process.executeCommand(
            args.command,
            args.cwd || REPO_ROOT,
            undefined,
            args.timeoutSeconds || runnerConfig.commandTimeoutSeconds
          );
          toolOutputs.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify({
              exitCode: execution.exitCode,
              stdout: truncateResult(execution.result || execution.artifacts?.stdout),
              stderr: truncateResult(execution.artifacts?.stderr || ""),
            }),
          });
          continue;
        }

        if (call.name === "read_file") {
          const fileBuffer = await sandbox.fs.downloadFile(args.path);
          toolOutputs.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify({
              content: truncateResult(fileBuffer.toString(), 20_000),
            }),
          });
          continue;
        }

        if (call.name === "write_file") {
          await sandbox.fs.uploadFiles([
            {
              source: Buffer.from(String(args.content || "")),
              destination: args.path,
            },
          ]);
          toolOutputs.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify({
              ok: true,
              path: args.path,
            }),
          });
          continue;
        }

        toolOutputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({
            ok: false,
            error: `Unknown tool ${call.name}`,
          }),
        });
      }

      pendingInputs = toolOutputs;
    }

    if (!finalText) {
      throw new Error("Repair agent exhausted iterations without a final response.");
    }

    const normalizedResult = normalizeRepairResult(parseJsonResponse(finalText), targetBranch);
    let patchText = "";
    let commitSha = normalizedResult.commitSha;

    if (normalizedResult.decision === "fix_pushed") {
      const artifacts = await collectFixArtifacts(
        sandbox,
        targetBranch,
        runnerConfig.commandTimeoutSeconds
      );
      patchText = artifacts.patchText;
      commitSha = artifacts.commitSha;
    }

    return {
      branchName: targetBranch,
      patchText,
      result: {
        ...normalizedResult,
        commitSha,
      },
    };
  } finally {
    await sandbox.delete();
  }
}

export { CONTEXT_ROOT, REPO_ROOT, SANDBOX_HOME, buildToolDefinitions, runSandboxCommand };
export { buildResponseCreateParams };
