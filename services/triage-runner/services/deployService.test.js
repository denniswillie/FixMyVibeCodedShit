import { buildDeployCommand } from "./deployService.js";

describe("deployService", () => {
  it("builds a branch-aware deploy command for the EC2 host", () => {
    expect(
      buildDeployCommand({
        repoDir: "/opt/gitbio",
        branch: "vibefix/7-1234567890",
        deployCommand: "bash ./deploy/scripts/deploy_ec2.sh",
      })
    ).toContain("git fetch origin 'vibefix/7-1234567890'");
  });

  it("includes checkout, pull, and deploy steps", () => {
    const command = buildDeployCommand({
      repoDir: "/opt/gitbio",
      branch: "main",
      deployCommand: "bash ./deploy/scripts/deploy_ec2.sh",
    });

    expect(command).toContain("cd '/opt/gitbio'");
    expect(command).toContain("git checkout 'main'");
    expect(command).toContain("git pull --ff-only origin 'main'");
    expect(command).toContain("bash ./deploy/scripts/deploy_ec2.sh");
  });
});
