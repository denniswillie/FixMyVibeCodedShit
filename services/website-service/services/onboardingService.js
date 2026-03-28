function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

const AGENT_CONFIG_SELECT = `
  github_repo_url,
  github_branch,
  github_access_token,
  github_installation_id,
  github_installation_account_login,
  github_installation_target_type,
  github_repository_selection,
  github_repo_count,
  github_connected_at,
  aws_access_key_id,
  aws_secret_access_key,
  aws_session_token,
  aws_region,
  ec2_instance_id,
  docker_service,
  log_tail,
  check_every_minutes,
  timezone,
  status,
  last_triaged_at,
  next_triage_at
`;

const AGENT_RUN_SELECT = `
  id,
  status,
  classifier_reason,
  summary,
  root_cause,
  fix_summary,
  patch_text,
  branch,
  commit_sha,
  pushed,
  deployed,
  error_message,
  started_at,
  finished_at,
  deployed_at,
  created_at
`;

function defaultAgentConfig() {
  return {
    github: {
      repoUrl: "",
      branch: "main",
      accessToken: "",
      connection: null
    },
    aws: {
      accessKeyId: "",
      secretAccessKey: "",
      sessionToken: "",
      region: "eu-west-1",
      instanceId: "",
      dockerService: "",
      logTail: 200
    },
    schedule: {
      everyMinutes: 15,
      timezone: "UTC"
    },
    status: "draft",
    lastTriagedAt: null,
    nextTriagedAt: null
  };
}

function mapGithubConnectionRow(row) {
  const installationId = Number(row?.github_installation_id || 0);

  if (!installationId) {
    return null;
  }

  return {
    installationId,
    accountLogin: String(row.github_installation_account_login || ""),
    targetType: String(row.github_installation_target_type || ""),
    repositorySelection: String(row.github_repository_selection || ""),
    repoCount: Number(row.github_repo_count || 0),
    connectedAt: toIso(row.github_connected_at)
  };
}

function mapAgentConfigRow(row) {
  if (!row) {
    return defaultAgentConfig();
  }

  return {
    github: {
      repoUrl: row.github_repo_url,
      branch: row.github_branch,
      accessToken: row.github_access_token,
      connection: mapGithubConnectionRow(row)
    },
    aws: {
      accessKeyId: row.aws_access_key_id,
      secretAccessKey: row.aws_secret_access_key,
      sessionToken: row.aws_session_token,
      region: row.aws_region,
      instanceId: row.ec2_instance_id,
      dockerService: row.docker_service,
      logTail: row.log_tail
    },
    schedule: {
      everyMinutes: row.check_every_minutes,
      timezone: row.timezone
    },
    status: row.status,
    lastTriagedAt: toIso(row.last_triaged_at),
    nextTriagedAt: toIso(row.next_triage_at)
  };
}

function mapLatestAgentRunRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    status: String(row.status || "running"),
    classifierReason: String(row.classifier_reason || ""),
    summary: String(row.summary || ""),
    rootCause: String(row.root_cause || ""),
    fixSummary: String(row.fix_summary || ""),
    patchText: String(row.patch_text || ""),
    branch: String(row.branch || ""),
    commitSha: String(row.commit_sha || ""),
    pushed: Boolean(row.pushed),
    deployed: Boolean(row.deployed),
    errorMessage: String(row.error_message || ""),
    startedAt: toIso(row.started_at),
    finishedAt: toIso(row.finished_at),
    deployedAt: toIso(row.deployed_at),
    createdAt: toIso(row.created_at)
  };
}

function chooseGithubRepository(existingRepoUrl, repositories = []) {
  if (!Array.isArray(repositories) || repositories.length === 0) {
    return null;
  }

  const normalizedExistingRepoUrl = String(existingRepoUrl || "").trim().toLowerCase();
  const matchedRepository = repositories.find(
    (repository) => String(repository?.htmlUrl || "").trim().toLowerCase() === normalizedExistingRepoUrl
  );

  return matchedRepository || repositories[0];
}

async function getAgentConfigForUser({ dbPool, userId }) {
  const result = await dbPool.query(
    `
      select
        ${AGENT_CONFIG_SELECT}
      from public.agent_configs
      where user_id = $1
      limit 1
    `,
    [userId]
  );

  return mapAgentConfigRow(result.rows[0] || null);
}

async function getLatestAgentRunForUser({ dbPool, userId }) {
  const result = await dbPool.query(
    `
      select
        ${AGENT_RUN_SELECT}
      from public.agent_runs
      where user_id = $1
      order by coalesce(finished_at, started_at, created_at) desc, created_at desc
      limit 1
    `,
    [userId]
  );

  return mapLatestAgentRunRow(result.rows[0] || null);
}

async function connectGithubInstallationForUser({ dbPool, userId, installation }) {
  const existingResult = await dbPool.query(
    `
      select
        github_repo_url,
        github_branch
      from public.agent_configs
      where user_id = $1
      limit 1
    `,
    [userId]
  );
  const existingRow = existingResult.rows[0] || null;
  const preferredRepository = chooseGithubRepository(
    existingRow?.github_repo_url,
    installation.repositories
  );
  const nextRepoUrl = preferredRepository?.htmlUrl || String(existingRow?.github_repo_url || "");
  const nextBranch =
    String(existingRow?.github_branch || "").trim() ||
    preferredRepository?.defaultBranch ||
    "main";

  const result = await dbPool.query(
    `
      insert into public.agent_configs (
        user_id,
        github_repo_url,
        github_branch,
        github_installation_id,
        github_installation_account_login,
        github_installation_target_type,
        github_repository_selection,
        github_repo_count,
        github_connected_at
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9
      )
      on conflict (user_id)
      do update set
        github_repo_url = case
          when excluded.github_repo_url <> '' then excluded.github_repo_url
          else public.agent_configs.github_repo_url
        end,
        github_branch = case
          when excluded.github_branch <> '' then excluded.github_branch
          else public.agent_configs.github_branch
        end,
        github_installation_id = excluded.github_installation_id,
        github_installation_account_login = excluded.github_installation_account_login,
        github_installation_target_type = excluded.github_installation_target_type,
        github_repository_selection = excluded.github_repository_selection,
        github_repo_count = excluded.github_repo_count,
        github_connected_at = excluded.github_connected_at,
        updated_at = timezone('utc', now())
      returning
        ${AGENT_CONFIG_SELECT}
    `,
    [
      userId,
      nextRepoUrl,
      nextBranch,
      installation.installationId,
      installation.accountLogin,
      installation.targetType,
      installation.repositorySelection,
      installation.repoCount,
      installation.connectedAt
    ]
  );

  return mapAgentConfigRow(result.rows[0]);
}

async function upsertAgentConfig({ dbPool, userId, config }) {
  const result = await dbPool.query(
    `
      insert into public.agent_configs (
        user_id,
        github_repo_url,
        github_branch,
        github_access_token,
        aws_access_key_id,
        aws_secret_access_key,
        aws_session_token,
        aws_region,
        ec2_instance_id,
        docker_service,
        log_tail,
        check_every_minutes,
        timezone,
        status,
        next_triage_at
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        'active',
        timezone('utc', now()) + ($12 * interval '1 minute')
      )
      on conflict (user_id)
      do update set
        github_repo_url = excluded.github_repo_url,
        github_branch = excluded.github_branch,
        github_access_token = excluded.github_access_token,
        aws_access_key_id = excluded.aws_access_key_id,
        aws_secret_access_key = excluded.aws_secret_access_key,
        aws_session_token = excluded.aws_session_token,
        aws_region = excluded.aws_region,
        ec2_instance_id = excluded.ec2_instance_id,
        docker_service = excluded.docker_service,
        log_tail = excluded.log_tail,
        check_every_minutes = excluded.check_every_minutes,
        timezone = excluded.timezone,
        status = 'active',
        next_triage_at = timezone('utc', now()) + (excluded.check_every_minutes * interval '1 minute'),
        updated_at = timezone('utc', now())
      returning
        ${AGENT_CONFIG_SELECT}
    `,
    [
      userId,
      config.github.repoUrl,
      config.github.branch,
      config.github.accessToken,
      config.aws.accessKeyId,
      config.aws.secretAccessKey,
      config.aws.sessionToken,
      config.aws.region,
      config.aws.instanceId,
      config.aws.dockerService,
      config.aws.logTail,
      config.schedule.everyMinutes,
      config.schedule.timezone
    ]
  );

  return mapAgentConfigRow(result.rows[0]);
}

module.exports = {
  chooseGithubRepository,
  connectGithubInstallationForUser,
  defaultAgentConfig,
  getAgentConfigForUser,
  getLatestAgentRunForUser,
  mapAgentConfigRow,
  mapLatestAgentRunRow,
  upsertAgentConfig
};
