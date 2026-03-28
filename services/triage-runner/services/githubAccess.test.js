import { buildAuthenticatedRepoUrl, parseGithubRepoUrl } from "./githubAccess.js";

describe("githubAccess", () => {
  it("parses owner and repo from the repository url", () => {
    expect(parseGithubRepoUrl("https://github.com/acme/api")).toEqual({
      owner: "acme",
      repo: "api",
    });
  });

  it("injects the token into the clone url", () => {
    expect(buildAuthenticatedRepoUrl("https://github.com/acme/api", "secret-token")).toBe(
      "https://x-access-token:secret-token@github.com/acme/api"
    );
  });
});
