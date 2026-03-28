const crypto = require("crypto");

const SESSION_TTL_DAYS = 30;
const SESSION_COOKIE_NAME =
  String(process.env.SESSION_COOKIE_NAME || "vibefix_session").trim() || "vibefix_session";

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("base64");
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function decodeCookieValue(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCookies(cookieHeader) {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");

      if (separatorIndex <= 0) {
        return cookies;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      cookies[key] = decodeCookieValue(value);
      return cookies;
    }, {});
}

function isSecureCookie() {
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${Math.max(0, Math.floor(Number(options.maxAge) || 0))}`);
  }

  if (options.expires instanceof Date) {
    segments.push(`Expires=${options.expires.toUTCString()}`);
  }

  segments.push(`Path=${options.path || "/"}`);

  if (options.httpOnly !== false) {
    segments.push("HttpOnly");
  }

  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    segments.push("Secure");
  }

  return segments.join("; ");
}

function appendSetCookie(res, cookieValue) {
  const currentValue = res.getHeader("Set-Cookie");
  const nextValue = Array.isArray(currentValue)
    ? currentValue.concat(cookieValue)
    : currentValue
      ? [currentValue, cookieValue]
      : [cookieValue];

  res.setHeader("Set-Cookie", nextValue);
}

function setSessionCookie(res, token, expiresAt) {
  appendSetCookie(
    res,
    serializeCookie(SESSION_COOKIE_NAME, token, {
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
      expires: expiresAt,
      httpOnly: true,
      path: "/",
      sameSite: "Lax",
      secure: isSecureCookie()
    })
  );
}

function clearSessionCookie(res) {
  appendSetCookie(
    res,
    serializeCookie(SESSION_COOKIE_NAME, "", {
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      path: "/",
      sameSite: "Lax",
      secure: isSecureCookie()
    })
  );
}

function readSessionTokenFromRequest(req) {
  const cookies = parseCookies(req.headers?.cookie);
  return cookies[SESSION_COOKIE_NAME] || "";
}

async function createSessionForUser({ db, userId, userAgent, ipAddress }) {
  const sessionToken = generateSessionToken();
  const sessionTokenHash = hashSessionToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.query(
    `
      insert into public.auth_sessions (
        user_id,
        session_token_hash,
        expires_at,
        user_agent,
        ip_address
      )
      values ($1, $2, $3::timestamptz, $4, nullif($5, '')::inet)
    `,
    [userId, sessionTokenHash, expiresAt.toISOString(), userAgent || null, ipAddress || ""]
  );

  return {
    sessionToken,
    expiresAt
  };
}

async function getSessionFromToken({ db, token }) {
  if (!token) {
    return null;
  }

  const sessionTokenHash = hashSessionToken(token);
  const result = await db.query(
    `
      select
        users.id,
        users.email,
        users.full_name,
        users.avatar_url,
        users.last_login_provider,
        users.email_verified_at,
        users.created_at
      from public.auth_sessions as sessions
      join public.users as users
        on users.id = sessions.user_id
      where sessions.session_token_hash = $1
        and sessions.revoked_at is null
        and sessions.expires_at > timezone('utc', now())
      limit 1
    `,
    [sessionTokenHash]
  );

  if (!result.rows[0]) {
    return null;
  }

  await db.query(
    `
      update public.auth_sessions
      set last_seen_at = timezone('utc', now())
      where session_token_hash = $1
    `,
    [sessionTokenHash]
  );

  return result.rows[0];
}

async function revokeSession({ db, token }) {
  if (!token) {
    return;
  }

  await db.query(
    `
      update public.auth_sessions
      set revoked_at = coalesce(revoked_at, timezone('utc', now()))
      where session_token_hash = $1
    `,
    [hashSessionToken(token)]
  );
}

module.exports = {
  SESSION_COOKIE_NAME,
  appendSetCookie,
  clearSessionCookie,
  createSessionForUser,
  getSessionFromToken,
  hashSessionToken,
  isSecureCookie,
  parseCookies,
  readSessionTokenFromRequest,
  revokeSession,
  serializeCookie,
  setSessionCookie
};
