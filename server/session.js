// Stateless session: a signed JWT in an HttpOnly cookie. Replaces
// express-session + connect-sqlite3, which cannot work on Lambda's ephemeral,
// per-execution-environment filesystem.
//
// The payload carries only { sub: <google profile id> }. Keeping it minimal
// means the cookie holds no PII, and requireAuth needs zero DynamoDB reads --
// strictly better than the old deserializeUser, which did a SELECT per request.

const jwt = require('jsonwebtoken');
const { getConfig } = require('./config');

const COOKIE_NAME = 'linky_session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matching the old cookie

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
}

async function signSession(googleId) {
  const { jwtSecret } = await getConfig();
  if (!jwtSecret) throw new Error('jwtSecret is not configured');
  return jwt.sign({ sub: String(googleId) }, jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '7d',
  });
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    ...baseCookieOptions(),
    maxAge: MAX_AGE_MS,
  });
}

// No maxAge here: clearCookie sets an expiry in the past, and a conflicting
// maxAge confuses some browsers.
function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, baseCookieOptions());
}

// Returns { id } or null. Never throws for a bad token.
async function readSession(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return null;

  const { jwtSecret } = await getConfig();
  if (!jwtSecret) throw new Error('jwtSecret is not configured');

  try {
    const claims = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    if (!claims || !claims.sub) return null;
    return { id: claims.sub };
  } catch (err) {
    return null;
  }
}

// Same 401 body as the original requireAuth in routes/links.js.
async function requireAuth(req, res, next) {
  try {
    const session = await readSession(req);
    if (!session) {
      clearSessionCookie(res); // stop the browser resending a dead cookie
      return res.status(401).json({ error: 'Not authenticated' });
    }
    req.user = session;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  COOKIE_NAME,
  signSession,
  setSessionCookie,
  clearSessionCookie,
  readSession,
  requireAuth,
};
