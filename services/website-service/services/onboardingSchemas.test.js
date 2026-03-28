const { parseOnboardingConfig } = require("./onboardingSchemas");

describe("onboardingSchemas", () => {
  it("parses a valid onboarding payload and coerces numeric fields", () => {
    const parsed = parseOnboardingConfig({
      github: {
        repoUrl: "https://github.com/acme/fragile-launch",
        branch: "main",
        accessToken: "",
        connection: {
          installationId: 99,
          accountLogin: "acme",
          targetType: "Organization",
          repositorySelection: "selected",
          repoCount: 1,
          connectedAt: "2026-03-28T14:00:00.000Z"
        }
      },
      ssh: {
        host: "ec2-1-2-3-4.compute.amazonaws.com",
        port: "22",
        username: "ubuntu",
        privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----demo",
        dockerService: "web",
        logTail: "250"
      },
      schedule: {
        everyMinutes: "15",
        timezone: "Europe/Dublin"
      }
    });

    expect(parsed.ssh.port).toBe(22);
    expect(parsed.ssh.logTail).toBe(250);
    expect(parsed.schedule.everyMinutes).toBe(15);
  });

  it("rejects an invalid repository url", () => {
    expect(() =>
      parseOnboardingConfig({
        github: {
          repoUrl: "not-a-url",
          branch: "main",
          accessToken: "",
          connection: null
        },
        ssh: {
          host: "ec2-1-2-3-4.compute.amazonaws.com",
          port: "22",
          username: "ubuntu",
          privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----demo",
          dockerService: "web",
          logTail: "250"
        },
        schedule: {
          everyMinutes: "15",
          timezone: "Europe/Dublin"
        }
      })
    ).toThrow(/github repository url/i);
  });
});
