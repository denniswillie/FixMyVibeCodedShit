const {
  chooseGithubRepository,
  connectGithubInstallationForUser,
  mapAgentConfigRow
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
        ec2_host: "",
        ec2_port: 22,
        ec2_username: "",
        ec2_private_key: "",
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
              ec2_host: "",
              ec2_port: 22,
              ec2_username: "",
              ec2_private_key: "",
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
});
