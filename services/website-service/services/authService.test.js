const { AuthServiceError, toPublicUser, upsertGoogleUser } = require("./authService");

describe("authService", () => {
  it("maps a database user row to a public user payload", () => {
    expect(
      toPublicUser({
        id: 7,
        email: "founder@vibefix.demo",
        full_name: "Launch Founder",
        avatar_url: "https://example.com/avatar.png",
        last_login_provider: "google",
        email_verified_at: "2026-03-28T12:00:00.000Z",
        created_at: "2026-03-28T11:00:00.000Z"
      })
    ).toEqual({
      id: 7,
      email: "founder@vibefix.demo",
      fullName: "Launch Founder",
      avatarUrl: "https://example.com/avatar.png",
      lastLoginProvider: "google",
      emailVerifiedAt: "2026-03-28T12:00:00.000Z",
      createdAt: "2026-03-28T11:00:00.000Z"
    });
  });

  it("rejects google profiles without a verified email", async () => {
    const client = {
      query: vi.fn()
    };

    await expect(
      upsertGoogleUser(client, {
        email: "founder@vibefix.demo",
        sub: "google-subject",
        email_verified: false
      })
    ).rejects.toBeInstanceOf(AuthServiceError);
  });
});
