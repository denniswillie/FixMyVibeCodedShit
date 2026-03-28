function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

export function mapClaimedAgentConfigRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: Number(row.user_id),
    github: {
      repoUrl: String(row.github_repo_url || ""),
      branch: String(row.github_branch || "main"),
      accessToken: String(row.github_access_token || ""),
      installationId: row.github_installation_id ? Number(row.github_installation_id) : null,
      accountLogin: String(row.github_installation_account_login || ""),
    },
    aws: {
      accessKeyId: String(row.aws_access_key_id || ""),
      secretAccessKey: String(row.aws_secret_access_key || ""),
      sessionToken: String(row.aws_session_token || ""),
      region: String(row.aws_region || ""),
      instanceId: String(row.ec2_instance_id || ""),
      dockerService: String(row.docker_service || ""),
      logTail: Number(row.log_tail || 200),
    },
    schedule: {
      everyMinutes: Number(row.check_every_minutes || 15),
      timezone: String(row.timezone || "UTC"),
    },
    status: String(row.status || "draft"),
    nextTriagedAt: toIso(row.next_triage_at),
    lastTriagedAt: toIso(row.last_triaged_at),
  };
}

export async function claimDueAgentConfig(client) {
  const result = await client.query(
    `
      with due as (
        select id
        from public.agent_configs
        where status = 'active'
          and next_triage_at is not null
          and next_triage_at <= timezone('utc', now())
        order by next_triage_at asc nulls first
        for update skip locked
        limit 1
      )
      update public.agent_configs as target
      set
        status = 'running',
        updated_at = timezone('utc', now())
      where target.id in (select id from due)
      returning
        id,
        user_id,
        github_repo_url,
        github_branch,
        github_access_token,
        github_installation_id,
        github_installation_account_login,
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
        next_triage_at,
        last_triaged_at
    `
  );

  return mapClaimedAgentConfigRow(result.rows[0] || null);
}

export async function markRunFinished(client, claimedConfig, nextStatus = "active") {
  await client.query(
    `
      update public.agent_configs
      set
        status = $2,
        last_triaged_at = timezone('utc', now()),
        next_triage_at = timezone('utc', now()) + ($3 * interval '1 minute'),
        updated_at = timezone('utc', now())
      where id = $1
    `,
    [claimedConfig.id, nextStatus, claimedConfig.schedule.everyMinutes]
  );
}

export async function markRunFailed(client, claimedConfig) {
  await markRunFinished(client, claimedConfig, "active");
}
