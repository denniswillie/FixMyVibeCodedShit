import { Daytona } from "@daytonaio/sdk";
import OpenAI from "openai";

import { buildAuthenticatedRepoUrl, parseGithubRepoUrl } from "./githubAccess.js";
import { buildRepairPrompt } from "./promptBuilder.js";

const REPO_ROOT = "/workspace/repo";
const CONTEXT_ROOT = "/workspace/context";

function truncateResult(value, limit = 12_000) {
  const text = String(value || "");

  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit)}\n...[truncated ${text.length - limit} chars]`;
}

function buildBranchName(config, claimedConfig) {
  return `${config.branchPrefix}${claimedConfig.userId}-${Date.now()}`;
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
            type: "string",
            description: "Absolute working directory. Defaults to /workspace/repo.",
          },
          timeoutSeconds: {
            type: "integer",
            description: "Timeout in seconds for the command.",
          },
        },
        required: ["command"],
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
  const branchName = buildBranchName(runnerConfig, claimedConfig);
  const repoCloneUrl = buildAuthenticatedRepoUrl(claimedConfig.github.repoUrl, githubToken);
  const sandbox = await daytona.create({
    language: runnerConfig.daytonaLanguage,
    autoStopInterval: runnerConfig.daytonaAutoStopInterval,
    envVars: {
      VIBEFIX_BRANCH_NAME: branchName,
      VIBEFIX_REPO_OWNER: owner,
      VIBEFIX_REPO_NAME: repo,
    },
    ...(runnerConfig.daytonaNetworkBlockAll ? { networkBlockAll: true } : {}),
  });

  try {
    await sandbox.process.executeCommand("mkdir -p /workspace/context", undefined, undefined, runnerConfig.commandTimeoutSeconds);
    await sandbox.process.executeCommand(
      `git clone ${repoCloneUrl} ${REPO_ROOT}`,
      undefined,
      undefined,
      runnerConfig.commandTimeoutSeconds
    );
    await sandbox.process.executeCommand(
      `git -C ${REPO_ROOT} checkout -b ${branchName}`,
      undefined,
      undefined,
      runnerConfig.commandTimeoutSeconds
    );
    await sandbox.process.executeCommand(
      `git -C ${REPO_ROOT} config user.name "${runnerConfig.gitAuthorName}" && git -C ${REPO_ROOT} config user.email "${runnerConfig.gitAuthorEmail}"`,
      undefined,
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
              branchName,
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
      branchName,
      logSnippet,
      classifier,
      pollTimestamp: new Date().toISOString(),
    });

    const tools = buildToolDefinitions();
    let previousResponseId;
    let pendingInputs = prompt;
    let finalText = "";

    for (let iteration = 0; iteration < runnerConfig.maxAgentIterations; iteration += 1) {
      const response = await openai.responses.create({
        model: runnerConfig.openAiModel,
        input: pendingInputs,
        ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
        reasoning: {
          effort: runnerConfig.openAiReasoningEffort,
        },
        store: false,
        tools,
      });

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

    return {
      branchName,
      result: parseJsonResponse(finalText),
    };
  } finally {
    await sandbox.delete();
  }
}
