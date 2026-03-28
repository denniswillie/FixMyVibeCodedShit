import { buildDeployCommand } from "./deployService.js";

describe("deployService", () => {
  it("builds a branch-aware deploy command for the EC2 host", () => {
    expect(
      buildDeployCommand({
        repoDir: "/opt/gitbio",
        branch: "vibefix/7-1234567890",
        deployCommand: "docker compose up -d --build website-service",
        deployUser: "ec2-user",
      })
    ).toContain(`git fetch origin '"'"'vibefix/7-1234567890'"'"'`);
  });

  it("runs the deploy as the configured non-root user", () => {
    const command = buildDeployCommand({
      repoDir: "/opt/gitbio",
      branch: "main",
      deployCommand: "docker compose up -d --build website-service",
      deployUser: "ec2-user",
    });

    expect(command).toContain("sudo -u 'ec2-user' -H bash -lc");
    expect(command).toContain(`cd '"'"'/opt/gitbio'"'"'`);
    expect(command).toContain(`git checkout '"'"'main'"'"'`);
    expect(command).toContain(`git pull --ff-only origin '"'"'main'"'"'`);
    expect(command).toContain("docker compose up -d --build website-service");
  });

  it("requires a deploy user", () => {
    expect(() =>
      buildDeployCommand({
        repoDir: "/opt/gitbio",
        branch: "main",
        deployCommand: "docker compose up -d --build website-service",
        deployUser: "",
      })
    ).toThrow("Deploy user is required.");
  });
});
