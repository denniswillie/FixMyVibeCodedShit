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
      aws: {
        accessKeyId: "AKIADEMO123",
        secretAccessKey: "secret-demo",
        sessionToken: "",
        region: "eu-west-1",
        instanceId: "i-0abc1234def567890",
        dockerService: "web",
        logTail: "250"
      },
      schedule: {
        everyMinutes: "15",
        timezone: "Europe/Dublin"
      }
    });

    expect(parsed.aws.region).toBe("eu-west-1");
    expect(parsed.aws.logTail).toBe(250);
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
        aws: {
          accessKeyId: "AKIADEMO123",
          secretAccessKey: "secret-demo",
          sessionToken: "",
          region: "eu-west-1",
          instanceId: "i-0abc1234def567890",
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
