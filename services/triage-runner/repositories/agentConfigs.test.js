import {
  mapClaimedAgentConfigRow,
} from "./agentConfigs.js";

describe("agentConfigs repository helpers", () => {
  it("maps a claimed row into runner config shape", () => {
    expect(
      mapClaimedAgentConfigRow({
        id: "cfg_123",
        user_id: 7,
        github_repo_url: "https://github.com/acme/api",
        github_branch: "main",
        github_access_token: "",
        github_installation_id: 42,
        github_installation_account_login: "acme",
        aws_access_key_id: "AKIADEMO123",
        aws_secret_access_key: "secret-demo",
        aws_session_token: "",
        aws_region: "eu-west-1",
        ec2_instance_id: "i-0abc1234def567890",
        docker_service: "web",
        log_tail: 200,
        check_every_minutes: 15,
        timezone: "Europe/Dublin",
        status: "running",
        next_triage_at: "2026-03-28T15:00:00.000Z",
        last_triaged_at: null,
      })
    ).toMatchObject({
      id: "cfg_123",
      userId: 7,
      github: {
        repoUrl: "https://github.com/acme/api",
        installationId: 42,
      },
      aws: {
        region: "eu-west-1",
        instanceId: "i-0abc1234def567890",
      },
      schedule: {
        everyMinutes: 15,
      },
      status: "running",
    });
  });
});
