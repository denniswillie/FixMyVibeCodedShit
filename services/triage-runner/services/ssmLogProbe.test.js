import { isInvocationNotReadyError } from "./ssmLogProbe.js";

describe("ssmLogProbe", () => {
  it("recognizes the eventual-consistency invocation error from SSM", () => {
    expect(
      isInvocationNotReadyError({
        name: "InvocationDoesNotExist",
        message: "UnknownError",
      })
    ).toBe(true);

    expect(
      isInvocationNotReadyError({
        __type: "InvocationDoesNotExist",
      })
    ).toBe(true);
  });

  it("does not misclassify unrelated SSM failures", () => {
    expect(
      isInvocationNotReadyError({
        name: "AccessDeniedException",
        message: "nope",
      })
    ).toBe(false);
  });
});
