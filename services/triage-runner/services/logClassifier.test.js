import { classifyLogSnippet } from "./logClassifier.js";

describe("logClassifier", () => {
  it("flags actionable errors", () => {
    expect(
      classifyLogSnippet("[error] payment webhook 500 after checkout session recovery")
    ).toMatchObject({
      shouldInvestigate: true,
      reason: "actionable_error_detected",
    });
  });

  it("ignores warning-only snippets", () => {
    expect(
      classifyLogSnippet("[warning] deprecated field used in request payload")
    ).toMatchObject({
      shouldInvestigate: false,
      reason: "warnings_only",
    });
  });
});
