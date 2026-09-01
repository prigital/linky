const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const store = require('../store');
const { getConfig } = require('../config');
const {
  signSession,
  setSessionCookie,
  clearSessionCookie,
  readSession,
} = require('../session');

const router = express.Router();

// The Google strategy needs its client credentials synchronously at
// construction, but they arrive asynchronously from Secrets Manager and
// CommonJS has no top-level await. Memoize the registration and await it at the
// top of the two OAuth routes. server/lambda.js primes this before serving, so
// in Lambda it is already resolved by the first request.
let strategyPromise = null;

function ensureStrategy() {
  if (strategyPromise) return strategyPromise;

  strategyPromise = getConfig()
    .then(function (config) {
      if (!config.googleClientId || !config.googleClientSecret) {
        throw new Error('Google OAuth client credentials are not configured');
      }

      passport.use(
        new GoogleStrategy(
          {
            clientID: config.googleClientId,
            clientSecret: config.googleClientSecret,
            // Overridden per request by callbackUrlFor(); this value is only a
            // fallback for the strategy's own validation.
            callbackURL: '/auth/google/callback',
          },
          function (accessToken, refreshToken, profile, done) {
            const googleId = profile.id;
            const email =
              profile.emails && profile.emails[0] ? profile.emails[0].value : null;
            const name = profile.displayName || null;
            const avatar =
              profile.photos && profile.photos[0] ? profile.photos[0].value : null;

            store
              .upsertUser({ googleId, email, name, avatar })
              .then(function (user) {
                done(null, user);
              })
              .catch(done);
          }
        )
      );
    })
    .catch(function (err) {
      strategyPromise = null; // never cache a failure
      throw err;
    });

  return strategyPromise;
}

// CloudFront strips the viewer Host header (AllViewerExceptHostHeader) and
// substitutes the API Gateway origin domain, so req.get('host') would yield
// <api-id>.execute-api.<region>.amazonaws.com and Google would reject the
// callback with redirect_uri_mismatch. A CloudFront Function copies the real
// host into x-forwarded-host before that stripping happens.
function appUrlFor(req) {
  if (process.env.APP_URL) return process.env.APP_URL;

  const forwarded = req.headers['x-forwarded-host'];
  if (forwarded) return `https://${forwarded.split(',')[0].trim()}`;

  return `${req.protocol}://${req.get('host')}`;
}

function callbackUrlFor(req) {
  return `${appUrlFor(req)}/auth/google/callback`;
}

// GET /auth/google
router.get('/google', function (req, res, next) {
  ensureStrategy()
    .then(function () {
      passport.authenticate('google', {
        scope: ['profile', 'email'],
        session: false,
        callbackURL: callbackUrlFor(req),
      })(req, res, next);
    })
    .catch(next);
});

// GET /auth/google/callback
// Google requires the callbackURL here to match the one used above exactly.
router.get('/google/callback', function (req, res, next) {
  ensureStrategy()
    .then(function () {
      passport.authenticate(
        'google',
        { session: false, callbackURL: callbackUrlFor(req) },
        function (err, user) {
          if (err) return next(err);
          if (!user) return res.redirect('/');

          signSession(user.google_id)
            .then(function (token) {
              setSessionCookie(res, token);
              res.redirect('/');
            })
            .catch(next);
        }
      )(req, res, next);
    })
    .catch(next);
});

// GET /auth/logout
// req.logout is a passport session API and must not be called now that there is
// no session. Clearing the cookie also fixes the original bug where logout left
// both the cookie and the session row in place.
router.get('/logout', function (req, res) {
  clearSessionCookie(res);
  res.redirect('/');
});

// GET /auth/me
router.get('/me', async function (req, res, next) {
  try {
    const session = await readSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await store.getUserById(session.id);
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
