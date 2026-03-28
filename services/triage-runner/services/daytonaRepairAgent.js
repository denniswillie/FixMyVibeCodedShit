import { Daytona } from "@daytonaio/sdk";
import OpenAI from "openai";

import { buildAuthenticatedRepoUrl, parseGithubRepoUrl } from "./githubAccess.js";
import { buildRepairPrompt } from "./promptBuilder.js";

const SANDBOX_HOME = "/home/daytona";
const REPO_ROOT = `${SANDBOX_HOME}/repo`;
const CONTEXT_ROOT = `${SANDBOX_HOME}/context`;
const PATCH_PATH = `${CONTEXT_ROOT}/fix.patch`;
const CRITICAL_RUNTIME_FAILURE_PATTERNS = [
  /\bTypeError\b/i,
  /\bReferenceError\b/i,
  /\bSyntaxError\b/i,
  /\bRangeError\b/i,
  /Cannot read properties/i,
  /\blogin\w*.*failed\b/i,
  /\bauth\].*failed\b/i,
  /\bat\s+\S+.*:\d+:\d+/i,
];

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

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

function buildCloneCommand(repoCloneUrl, targetBranch) {
  return [
    "GIT_TERMINAL_PROMPT=0",
    "git clone",
    "--depth 1",
    "--single-branch",
    `--branch ${shellEscape(targetBranch)}`,
    shellEscape(repoCloneUrl),
    shellEscape(REPO_ROOT),
  ].join(" ");
}

function buildGitConfigCommand({ gitAuthorEmail, gitAuthorName }) {
  return [
    `git -C ${shellEscape(REPO_ROOT)} config user.name ${shellEscape(gitAuthorName)}`,
    `git -C ${shellEscape(REPO_ROOT)} config user.email ${shellEscape(gitAuthorEmail)}`,
  ].join(" && ");
}

function buildRepoHeadCommand() {
  return `git -C ${shellEscape(REPO_ROOT)} rev-parse HEAD`;
}

function buildRepoStateCommand(targetBranch) {
  return [
    `head=$(git -C ${shellEscape(REPO_ROOT)} rev-parse HEAD)`,
    `subject=$(git -C ${shellEscape(REPO_ROOT)} log -1 --format=%s)`,
    `author_name=$(git -C ${shellEscape(REPO_ROOT)} log -1 --format=%an)`,
    `author_email=$(git -C ${shellEscape(REPO_ROOT)} log -1 --format=%ae)`,
    `remote=$(git -C ${shellEscape(REPO_ROOT)} ls-remote origin ${shellEscape(`refs/heads/${targetBranch}`)} | awk 'NR==1 {print $1}')`,
    "printf '%s\\n%s\\n%s\\n%s\\n%s' \"$head\" \"$subject\" \"$author_name\" \"$author_email\" \"$remote\"",
  ].join(" ; ");
}

function parseRepoStateOutput(outputText) {
  const [headSha = "", subject = "", authorName = "", authorEmail = "", remoteHeadSha = ""] =
    String(outputText || "").split("\n");

  return {
    headSha: String(headSha).trim(),
    subject: String(subject).trim(),
    authorName: String(authorName).trim(),
    authorEmail: String(authorEmail).trim(),
    remoteHeadSha: String(remoteHeadSha).trim(),
  };
}

function buildObservedPushResult({
  initialHead,
  logSnippet,
  normalizedResult,
  repoState,
  runnerConfig,
  targetBranch,
}) {
  const authorMatches =
    repoState.authorEmail === String(runnerConfig.gitAuthorEmail || "").trim() ||
    repoState.authorName === String(runnerConfig.gitAuthorName || "").trim();
  const headAdvanced = Boolean(repoState.headSha) && repoState.headSha !== initialHead;
  const remoteMatchesHead =
    Boolean(repoState.remoteHeadSha) && repoState.remoteHeadSha === repoState.headSha;

  if (!authorMatches || !headAdvanced || !remoteMatchesHead) {
    return null;
  }

  const priorVerification = Array.isArray(normalizedResult?.verification)
    ? normalizedResult.verification
    : [];
  const verification = Array.from(
    new Set([
      ...priorVerification,
      `Observed ${targetBranch} advancing to ${repoState.headSha} during the Daytona repair run.`,
    ])
  );

  return {
    decision: "fix_pushed",
    confidence: Math.max(Number(normalizedResult?.confidence || 0), hasCriticalRuntimeFailure(logSnippet) ? 0.9 : 0.82),
    summary:
      String(normalizedResult?.summary || "").trim() ||
      `Vibefix pushed ${repoState.headSha.slice(0, 7)} to ${targetBranch}: ${repoState.subject || "repair commit"}`,
    rootCause:
      String(normalizedResult?.rootCause || "").trim() ||
      (hasCriticalRuntimeFailure(logSnippet)
        ? "A real production runtime exception was addressed by a direct commit on the target branch."
        : "Vibefix pushed a direct repair to the target branch."),
    fixSummary:
      String(normalizedResult?.fixSummary || "").trim() || repoState.subject || "Pushed a direct repair commit.",
    verification,
    branch: targetBranch,
    commitSha: repoState.headSha,
    pushed: true,
  };
}

function buildExhaustedIterationsResult({ targetBranch, logSnippet, toolNames }) {
  const criticalRuntimeFailure = hasCriticalRuntimeFailure(logSnippet);

  return {
    decision: "needs_human",
    confidence: criticalRuntimeFailure ? 0.62 : 0.45,
    summary: criticalRuntimeFailure
      ? "Vibefix confirmed a real production exception, but the repair agent used its full tool budget before it could finish a safe verified fix."
      : "Vibefix used its full tool budget before it could finish a safe verified fix.",
    rootCause: criticalRuntimeFailure
      ? "The log excerpt shows a real runtime exception, but the repair loop did not converge before the Daytona tool budget was exhausted."
      : "The repair loop did not converge before the Daytona tool budget was exhausted.",
    fixSummary: "",
    verification: toolNames.length
      ? [`Repair agent exhausted its tool budget after using: ${toolNames.join(", ")}`]
      : ["Repair agent exhausted its tool budget before producing a final response."],
    branch: targetBranch,
    commitSha: "",
    pushed: false,
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

function hasCriticalRuntimeFailure(logSnippet) {
  const text = String(logSnippet || "");
  return CRITICAL_RUNTIME_FAILURE_PATTERNS.some((pattern) => pattern.test(text));
}

function normalizeRepairResult(result, targetBranch, classifier, logSnippet) {
  const normalized = {
    ...result,
    branch: String(result?.branch || targetBranch).trim() || targetBranch,
    commitSha: String(result?.commitSha || "").trim(),
    pushed: Boolean(result?.pushed),
    verification: Array.isArray(result?.verification) ? result.verification : [],
  };

  if (
    normalized.decision === "no_issue" &&
    String(classifier?.reason || "") === "actionable_error_detected" &&
    hasCriticalRuntimeFailure(logSnippet)
  ) {
    return {
      ...normalized,
      decision: "needs_human",
      confidence: Math.min(Number(normalized.confidence || 0), 0.75),
      summary:
        String(normalized.summary || "").trim() ||
        "Production logs show a real runtime exception, so Vibefix refused to classify this run as healthy.",
      rootCause:
        String(normalized.rootCause || "").trim() ||
        "A production runtime exception was present in the log excerpt, but the repair agent did not ship a verified fix.",
      fixSummary: String(normalized.fixSummary || "").trim(),
      commitSha: "",
      pushed: false,
    };
  }

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

async function inspectRepoState(sandbox, targetBranch, timeoutSeconds) {
  const repoStateExecution = await runSandboxCommand(
    sandbox,
    buildRepoStateCommand(targetBranch),
    undefined,
    timeoutSeconds
  );
  return parseRepoStateOutput(getExecutionOutput(repoStateExecution));
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
      buildCloneCommand(repoCloneUrl, targetBranch),
      undefined,
      runnerConfig.commandTimeoutSeconds
    );
    await runSandboxCommand(
      sandbox,
      buildGitConfigCommand({
        gitAuthorEmail: runnerConfig.gitAuthorEmail,
        gitAuthorName: runnerConfig.gitAuthorName,
      }),
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
    const initialHeadExecution = await runSandboxCommand(
      sandbox,
      buildRepoHeadCommand(),
      undefined,
      runnerConfig.commandTimeoutSeconds
    );
    const initialHead = getExecutionOutput(initialHeadExecution);

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
    let lastToolNames = [];

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
      lastToolNames = toolCalls.map((call) => String(call.name || "")).filter(Boolean);
      console.log(
        `[triage-runner] user=${claimedConfig.userId} agent iteration=${iteration + 1}/${runnerConfig.maxAgentIterations} tool_calls=${lastToolNames.join(", ") || "none"}`
      );

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
      try {
        const finalResponse = await openai.responses.create(
          buildResponseCreateParams({
            input: pendingInputs,
            model: runnerConfig.openAiModel,
            previousResponseId,
            reasoningEffort: runnerConfig.openAiReasoningEffort,
            tools: [],
          })
        );
        finalText = String(finalResponse.output_text || "").trim();
      } catch (error) {
        console.warn("[triage-runner] repair agent final synthesis failed:", error);
      }
    }

    if (!finalText) {
      const repoState = await inspectRepoState(
        sandbox,
        targetBranch,
        runnerConfig.commandTimeoutSeconds
      );
      const observedPushResult = buildObservedPushResult({
        initialHead,
        logSnippet,
        normalizedResult: null,
        repoState,
        runnerConfig,
        targetBranch,
      });

      if (observedPushResult) {
        console.log(
          `[triage-runner] user=${claimedConfig.userId} observed pushed fix commit=${observedPushResult.commitSha}`
        );
        const artifacts = await collectFixArtifacts(
          sandbox,
          targetBranch,
          runnerConfig.commandTimeoutSeconds
        );
        return {
          branchName: targetBranch,
          patchText: artifacts.patchText,
          result: {
            ...observedPushResult,
            commitSha: artifacts.commitSha,
          },
        };
      }

      return {
        branchName: targetBranch,
        patchText: "",
        result: buildExhaustedIterationsResult({
          targetBranch,
          logSnippet,
          toolNames: lastToolNames,
        }),
      };
    }

    let normalizedResult;

    try {
      normalizedResult = normalizeRepairResult(
        parseJsonResponse(finalText),
        targetBranch,
        classifier,
        logSnippet
      );
    } catch (error) {
      console.warn("[triage-runner] repair agent returned non-JSON final output:", finalText);
      return {
        branchName: targetBranch,
        patchText: "",
        result: buildExhaustedIterationsResult({
          targetBranch,
          logSnippet,
          toolNames: lastToolNames,
        }),
      };
    }

    const repoState = await inspectRepoState(
      sandbox,
      targetBranch,
      runnerConfig.commandTimeoutSeconds
    );
    const observedPushResult = buildObservedPushResult({
      initialHead,
      logSnippet,
      normalizedResult,
      repoState,
      runnerConfig,
      targetBranch,
    });

    if (observedPushResult && normalizedResult.decision !== "fix_pushed") {
      console.log(
        `[triage-runner] user=${claimedConfig.userId} promoting run to fix_pushed from observed repo state commit=${observedPushResult.commitSha}`
      );
      normalizedResult = observedPushResult;
    }
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

export {
  buildObservedPushResult,
  buildCloneCommand,
  buildExhaustedIterationsResult,
  buildGitConfigCommand,
  buildRepoHeadCommand,
  buildRepoStateCommand,
  buildResponseCreateParams,
  hasCriticalRuntimeFailure,
  inspectRepoState,
  CONTEXT_ROOT,
  parseRepoStateOutput,
  REPO_ROOT,
  SANDBOX_HOME,
  buildToolDefinitions,
  normalizeRepairResult,
  runSandboxCommand,
};
