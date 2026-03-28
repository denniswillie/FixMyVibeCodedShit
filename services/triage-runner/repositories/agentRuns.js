function toJson(value, fallback) {
  if (value === undefined) {
    return JSON.stringify(fallback);
  }

  return JSON.stringify(value);
}

export async function createAgentRun(client, claimedConfig) {
  const result = await client.query(
    `
      insert into public.agent_runs (
        agent_config_id,
        user_id,
        status
      )
      values (
        $1,
        $2,
        'running'
      )
      returning id
    `,
    [claimedConfig.id, claimedConfig.userId]
  );

  return String(result.rows[0]?.id || "");
}

export async function finishAgentRun(client, runId, payload) {
  await client.query(
    `
      update public.agent_runs
      set
        status = $2,
        classifier_reason = $3,
        matched_patterns = $4::jsonb,
        log_excerpt = $5,
        summary = $6,
        root_cause = $7,
        fix_summary = $8,
        patch_text = $9,
        verification = $10::jsonb,
        branch = $11,
        commit_sha = $12,
        pushed = $13,
        deployed = $14,
        deployed_at = $15,
        error_message = $16,
        finished_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
      where id = $1
    `,
    [
      runId,
      payload.status,
      payload.classifierReason || "",
      toJson(payload.matchedPatterns, []),
      payload.logExcerpt || "",
      payload.summary || "",
      payload.rootCause || "",
      payload.fixSummary || "",
      payload.patchText || "",
      toJson(payload.verification, []),
      payload.branch || "",
      payload.commitSha || "",
      Boolean(payload.pushed),
      Boolean(payload.deployed),
      payload.deployedAt || null,
      payload.errorMessage || "",
    ]
  );
}
