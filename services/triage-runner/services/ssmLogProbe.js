import {
  GetCommandInvocationCommand,
  SendCommandCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";

export function buildDockerLogCommand({ dockerService, logTail }) {
  return `docker logs --tail ${Number(logTail || 200)} ${dockerService}`;
}

function buildCredentials(agentConfig) {
  const { accessKeyId, secretAccessKey, sessionToken } = agentConfig.aws;
  return {
    accessKeyId,
    secretAccessKey,
    ...(sessionToken ? { sessionToken } : {}),
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runSsmShellCommand(agentConfig, command, options) {
  const client = new SSMClient({
    region: agentConfig.aws.region,
    credentials: buildCredentials(agentConfig),
  });

  const sendResponse = await client.send(
    new SendCommandCommand({
      DocumentName: options.ssmDocumentName,
      InstanceIds: [agentConfig.aws.instanceId],
      Parameters: {
        commands: [command],
      },
    })
  );

  const commandId = sendResponse.Command?.CommandId;

  if (!commandId) {
    throw new Error("SSM did not return a command id.");
  }

  for (let attempt = 0; attempt < options.ssmMaxPollAttempts; attempt += 1) {
    const invocation = await client.send(
      new GetCommandInvocationCommand({
        CommandId: commandId,
        InstanceId: agentConfig.aws.instanceId,
      })
    );

    const status = String(invocation.Status || "");

    if (status === "Success") {
      return {
        commandId,
        status,
        stdout: String(invocation.StandardOutputContent || ""),
        stderr: String(invocation.StandardErrorContent || ""),
      };
    }

    if (["Cancelled", "Failed", "TimedOut", "Cancelling"].includes(status)) {
      throw new Error(
        `SSM command ${commandId} failed with status ${status}: ${String(
          invocation.StandardErrorContent || ""
        )}`
      );
    }

    await sleep(options.ssmPollIntervalMs);
  }

  throw new Error(`SSM command ${commandId} did not finish before timeout.`);
}

export async function fetchDockerLogs(agentConfig, options) {
  return runSsmShellCommand(
    agentConfig,
    buildDockerLogCommand(agentConfig.aws),
    options
  );
}
