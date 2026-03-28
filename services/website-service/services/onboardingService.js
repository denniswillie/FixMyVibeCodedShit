function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function defaultAgentConfig() {
  return {
    github: {
      repoUrl: "",
      branch: "main",
      accessToken: ""
    },
    ssh: {
      host: "",
      port: 22,
      username: "ubuntu",
      privateKey: "",
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

function mapAgentConfigRow(row) {
  if (!row) {
    return defaultAgentConfig();
  }

  return {
    github: {
      repoUrl: row.github_repo_url,
      branch: row.github_branch,
      accessToken: row.github_access_token
    },
    ssh: {
      host: row.ec2_host,
      port: row.ec2_port,
      username: row.ec2_username,
      privateKey: row.ec2_private_key,
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

async function getAgentConfigForUser({ dbPool, userId }) {
  const result = await dbPool.query(
    `
      select
        github_repo_url,
        github_branch,
        github_access_token,
        ec2_host,
        ec2_port,
        ec2_username,
        ec2_private_key,
        docker_service,
        log_tail,
        check_every_minutes,
        timezone,
        status,
        last_triaged_at,
        next_triage_at
      from public.agent_configs
      where user_id = $1
      limit 1
    `,
    [userId]
  );

  return mapAgentConfigRow(result.rows[0] || null);
}

async function upsertAgentConfig({ dbPool, userId, config }) {
  const result = await dbPool.query(
    `
      insert into public.agent_configs (
        user_id,
        github_repo_url,
        github_branch,
        github_access_token,
        ec2_host,
        ec2_port,
        ec2_username,
        ec2_private_key,
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
        'active',
        timezone('utc', now()) + ($11 * interval '1 minute')
      )
      on conflict (user_id)
      do update set
        github_repo_url = excluded.github_repo_url,
        github_branch = excluded.github_branch,
        github_access_token = excluded.github_access_token,
        ec2_host = excluded.ec2_host,
        ec2_port = excluded.ec2_port,
        ec2_username = excluded.ec2_username,
        ec2_private_key = excluded.ec2_private_key,
        docker_service = excluded.docker_service,
        log_tail = excluded.log_tail,
        check_every_minutes = excluded.check_every_minutes,
        timezone = excluded.timezone,
        status = 'active',
        next_triage_at = timezone('utc', now()) + (excluded.check_every_minutes * interval '1 minute'),
        updated_at = timezone('utc', now())
      returning
        github_repo_url,
        github_branch,
        github_access_token,
        ec2_host,
        ec2_port,
        ec2_username,
        ec2_private_key,
        docker_service,
        log_tail,
        check_every_minutes,
        timezone,
        status,
        last_triaged_at,
        next_triage_at
    `,
    [
      userId,
      config.github.repoUrl,
      config.github.branch,
      config.github.accessToken,
      config.ssh.host,
      config.ssh.port,
      config.ssh.username,
      config.ssh.privateKey,
      config.ssh.dockerService,
      config.ssh.logTail,
      config.schedule.everyMinutes,
      config.schedule.timezone
    ]
  );

  return mapAgentConfigRow(result.rows[0]);
}

module.exports = {
  defaultAgentConfig,
  getAgentConfigForUser,
  mapAgentConfigRow,
  upsertAgentConfig
};
