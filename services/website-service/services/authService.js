const { createSessionForUser } = require("./sessionService");

class AuthServiceError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "AuthServiceError";
    this.status = status;
    this.code = code;
  }
}

function normalizeEmail(rawEmail) {
  return String(rawEmail || "").trim().toLowerCase();
}

function sanitizeText(value, maxLength = 255) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function toPublicUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    lastLoginProvider: row.last_login_provider,
    emailVerifiedAt: toIso(row.email_verified_at),
    createdAt: toIso(row.created_at)
  };
}

async function findUserForGoogle(client, email, googleSubject) {
  const result = await client.query(
    `
      select
        id,
        email,
        full_name,
        avatar_url,
        google_subject,
        last_login_provider,
        email_verified_at,
        created_at
      from public.users
      where lower(email) = lower($1)
         or google_subject = $2
      order by case when lower(email) = lower($1) then 0 else 1 end
      limit 1
      for update
    `,
    [email, googleSubject]
  );

  return result.rows[0] || null;
}

async function upsertGoogleUser(client, profile) {
  const normalizedEmail = normalizeEmail(profile.email);
  const googleSubject = sanitizeText(profile.sub, 255);
  const fullName = sanitizeText(profile.name, 255);
  const avatarUrl = sanitizeText(profile.picture, 2048);
  const emailVerified = profile.email_verified === true;

  if (!normalizedEmail) {
    throw new AuthServiceError(400, "google_oauth_failed", "Google did not return an email address.");
  }

  if (!emailVerified) {
    throw new AuthServiceError(
      400,
      "google_email_unverified",
      "Google account email must be verified to continue."
    );
  }

  let existingUser = await findUserForGoogle(client, normalizedEmail, googleSubject);

  if (!existingUser) {
    const inserted = await client.query(
      `
        insert into public.users (
          email,
          full_name,
          avatar_url,
          google_subject,
          last_login_provider,
          email_verified_at
        )
        values ($1, $2, $3, $4, 'google', timezone('utc', now()))
        on conflict do nothing
        returning
          id,
          email,
          full_name,
          avatar_url,
          last_login_provider,
          email_verified_at,
          created_at
      `,
      [normalizedEmail, fullName, avatarUrl, googleSubject]
    );

    if (inserted.rows[0]) {
      return inserted.rows[0];
    }

    existingUser = await findUserForGoogle(client, normalizedEmail, googleSubject);
  }

  if (!existingUser) {
    throw new AuthServiceError(500, "google_oauth_failed", "Unable to finish Google sign-in.");
  }

  const updated = await client.query(
    `
      update public.users
      set email = $2,
          full_name = coalesce($3, full_name),
          avatar_url = coalesce($4, avatar_url),
          google_subject = coalesce($5, google_subject),
          last_login_provider = 'google',
          email_verified_at = coalesce(email_verified_at, timezone('utc', now())),
          updated_at = timezone('utc', now())
      where id = $1
      returning
        id,
        email,
        full_name,
        avatar_url,
        last_login_provider,
        email_verified_at,
        created_at
    `,
    [existingUser.id, normalizedEmail, fullName, avatarUrl, googleSubject]
  );

  return updated.rows[0] || null;
}

async function loginWithGoogleProfile({ dbPool, profile, userAgent, ipAddress }) {
  const client = await dbPool.connect();

  try {
    await client.query("begin");
    const user = await upsertGoogleUser(client, profile);
    const session = await createSessionForUser({
      db: client,
      userId: user.id,
      userAgent,
      ipAddress
    });
    await client.query("commit");

    return {
      user: toPublicUser(user),
      sessionToken: session.sessionToken,
      sessionExpiresAt: session.expiresAt
    };
  } catch (error) {
    await client.query("rollback");

    if (error instanceof AuthServiceError) {
      throw error;
    }

    console.error("[auth/google] login failed:", error);
    throw new AuthServiceError(500, "google_oauth_failed", "Unable to finish Google sign-in.");
  } finally {
    client.release();
  }
}

module.exports = {
  AuthServiceError,
  loginWithGoogleProfile,
  normalizeEmail,
  toPublicUser,
  upsertGoogleUser
};
