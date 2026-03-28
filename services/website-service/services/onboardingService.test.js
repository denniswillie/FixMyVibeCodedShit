const {
  chooseGithubRepository,
  connectGithubInstallationForUser,
  getLatestFixRunForUser,
  upsertAgentConfig,
  mapAgentConfigRow,
  mapLatestAgentRunRow
} = require("./onboardingService");

describe("onboardingService", () => {
  it("prefers an already-selected repository when it is still accessible", () => {
    const repository = chooseGithubRepository("https://github.com/acme/api", [
      {
        htmlUrl: "https://github.com/acme/web",
        defaultBranch: "main"
      },
      {
        htmlUrl: "https://github.com/acme/api",
        defaultBranch: "stable"
      }
    ]);

    expect(repository).toMatchObject({
      htmlUrl: "https://github.com/acme/api",
      defaultBranch: "stable"
    });
  });

  it("maps github installation metadata into the frontend config shape", () => {
    expect(
      mapAgentConfigRow({
        github_repo_url: "https://github.com/acme/fragile-launch",
        github_branch: "main",
        github_access_token: "",
        github_installation_id: 99,
        github_installation_account_login: "acme",
        github_installation_target_type: "Organization",
        github_repository_selection: "selected",
        github_repo_count: 1,
        github_connected_at: "2026-03-28T14:00:00.000Z",
        aws_access_key_id: "AKIADEMO123",
        aws_secret_access_key: "secret-demo",
        aws_session_token: "",
        aws_region: "eu-west-1",
        ec2_instance_id: "i-0abc1234def567890",
        docker_service: "",
        log_tail: 200,
        check_every_minutes: 15,
        timezone: "UTC",
        status: "draft",
        last_triaged_at: null,
        next_triage_at: null
      })
    ).toMatchObject({
      github: {
        repoUrl: "https://github.com/acme/fragile-launch",
        connection: {
          installationId: 99,
          accountLogin: "acme",
          targetType: "Organization",
          repositorySelection: "selected",
          repoCount: 1,
          connectedAt: "2026-03-28T14:00:00.000Z"
        }
      }
    });
  });

  it("upserts github installation metadata and seeds the first accessible repo", async () => {
    const dbPool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: []
        })
        .mockResolvedValueOnce({
          rows: [
            {
              github_repo_url: "https://github.com/acme/fragile-launch",
              github_branch: "main",
              github_access_token: "",
              github_installation_id: 123,
              github_installation_account_login: "acme",
              github_installation_target_type: "Organization",
              github_repository_selection: "selected",
              github_repo_count: 1,
              github_connected_at: "2026-03-28T14:00:00.000Z",
              aws_access_key_id: "",
              aws_secret_access_key: "",
              aws_session_token: "",
              aws_region: "eu-west-1",
              ec2_instance_id: "",
              docker_service: "",
              log_tail: 200,
              check_every_minutes: 15,
              timezone: "UTC",
              status: "draft",
              last_triaged_at: null,
              next_triage_at: null
            }
          ]
        })
    };

    const result = await connectGithubInstallationForUser({
      dbPool,
      userId: 7,
      installation: {
        installationId: 123,
        accountLogin: "acme",
        targetType: "Organization",
        repositorySelection: "selected",
        repoCount: 1,
        connectedAt: "2026-03-28T14:00:00.000Z",
        repositories: [
          {
            htmlUrl: "https://github.com/acme/fragile-launch",
            defaultBranch: "main"
          }
        ]
      }
    });

    expect(dbPool.query).toHaveBeenCalledTimes(2);
    expect(dbPool.query.mock.calls[1][1]).toEqual(
      expect.arrayContaining([
        7,
        "https://github.com/acme/fragile-launch",
        "main",
        123
      ])
    );
    expect(result.github.connection).toMatchObject({
      installationId: 123,
      accountLogin: "acme"
    });
  });

  it("maps the latest agent run into the dashboard shape", () => {
    expect(
      mapLatestAgentRunRow({
        id: "run_123",
        status: "deployed",
        classifier_reason: "actionable_error_detected",
        summary: "Patched the broken profile query and redeployed GitBio.",
        root_cause: "A null author field crashed the serializer.",
        fix_summary: "Guarded the serializer and added a fallback.",
        patch_text: "diff --git a/app.js b/app.js",
        branch: "master",
        commit_sha: "abc123def456",
        pushed: true,
        deployed: true,
        error_message: "",
        started_at: "2026-03-28T15:00:00.000Z",
        finished_at: "2026-03-28T15:02:00.000Z",
        deployed_at: "2026-03-28T15:02:00.000Z",
        created_at: "2026-03-28T15:00:00.000Z"
      })
    ).toMatchObject({
      id: "run_123",
      status: "deployed",
      summary: "Patched the broken profile query and redeployed GitBio.",
      patchText: "diff --git a/app.js b/app.js",
      branch: "master",
      commitSha: "abc123def456",
      deployed: true
    });
  });

  it("loads the latest shipped fix separately from the latest run", async () => {
    const dbPool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "run_fix",
            status: "fix_pushed",
            classifier_reason: "actionable_error_detected",
            summary: "Shipped a checkout fix.",
            root_cause: "Null payload",
            fix_summary: "Added a fallback.",
            patch_text: "diff --git a/app.js b/app.js",
            branch: "master",
            commit_sha: "fix123abc",
            pushed: true,
            deployed: false,
            error_message: "",
            started_at: "2026-03-28T15:00:00.000Z",
            finished_at: "2026-03-28T15:01:00.000Z",
            deployed_at: null,
            created_at: "2026-03-28T15:00:00.000Z"
          }
        ]
      })
    };

    const result = await getLatestFixRunForUser({
      dbPool,
      userId: 7
    });

    expect(dbPool.query).toHaveBeenCalledWith(
      expect.stringContaining("status in ('fix_pushed', 'deployed')"),
      [7]
    );
    expect(result).toMatchObject({
      id: "run_fix",
      status: "fix_pushed",
      commitSha: "fix123abc",
      pushed: true
    });
  });

  it("marks a saved config as immediately due for the first triage run", async () => {
    const dbPool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            github_repo_url: "https://github.com/denniswillie/GitBio",
            github_branch: "main",
            github_access_token: "",
            github_installation_id: 123,
            github_installation_account_login: "denniswillie",
            github_installation_target_type: "User",
            github_repository_selection: "selected",
            github_repo_count: 1,
            github_connected_at: "2026-03-28T14:00:00.000Z",
            aws_access_key_id: "AKIADEMO123",
            aws_secret_access_key: "secret-demo",
            aws_session_token: "",
            aws_region: "eu-west-1",
            ec2_instance_id: "i-06c6472bc2cb00ddd",
            docker_service: "gitbio-website-service-1",
            log_tail: 200,
            check_every_minutes: 15,
            timezone: "UTC",
            status: "active",
            last_triaged_at: null,
            next_triage_at: "2026-03-28T14:00:00.000Z"
          }
        ]
      })
    };

    await upsertAgentConfig({
      dbPool,
      userId: 7,
      config: {
        github: {
          repoUrl: "https://github.com/denniswillie/GitBio",
          branch: "main",
          accessToken: "",
          connection: null
        },
        aws: {
          accessKeyId: "AKIADEMO123",
          secretAccessKey: "secret-demo",
          sessionToken: "",
          region: "eu-west-1",
          instanceId: "i-06c6472bc2cb00ddd",
          dockerService: "gitbio-website-service-1",
          logTail: 200
        },
        schedule: {
          everyMinutes: 15,
          timezone: "UTC"
        }
      }
    });

    expect(dbPool.query).toHaveBeenCalledTimes(1);
    expect(dbPool.query.mock.calls[0][0]).toContain("$11::integer");
    expect(dbPool.query.mock.calls[0][0]).toContain("$12::integer");
    expect(dbPool.query.mock.calls[0][0]).toContain("next_triage_at = timezone('utc', now())");
  });
});
