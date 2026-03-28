const {
  SESSION_COOKIE_NAME,
  hashSessionToken,
  parseCookies,
  serializeCookie,
  setSessionCookie
} = require("./sessionService");

describe("sessionService", () => {
  it("parses cookies from a header string", () => {
    expect(parseCookies("alpha=one; beta=two%20words")).toEqual({
      alpha: "one",
      beta: "two words"
    });
  });

  it("serializes a secure http-only cookie", () => {
    const cookie = serializeCookie("demo", "token", {
      maxAge: 10,
      httpOnly: true,
      sameSite: "Lax",
      secure: true
    });

    expect(cookie).toContain("demo=token");
    expect(cookie).toContain("Max-Age=10");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
  });

  it("sets the named session cookie on the response", () => {
    const headers = {};
    const res = {
      getHeader(name) {
        return headers[name];
      },
      setHeader(name, value) {
        headers[name] = value;
      }
    };

    setSessionCookie(res, "plain-token", new Date("2030-01-01T00:00:00.000Z"));

    expect(Array.isArray(headers["Set-Cookie"])).toBe(true);
    expect(headers["Set-Cookie"][0]).toContain(`${SESSION_COOKIE_NAME}=plain-token`);
  });

  it("hashes a session token deterministically", () => {
    expect(hashSessionToken("abc123")).toBe(hashSessionToken("abc123"));
    expect(hashSessionToken("abc123")).not.toBe(hashSessionToken("def456"));
  });
});
