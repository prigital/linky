const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { db } = require('../db');

const router = express.Router();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.APP_URL
        ? `${process.env.APP_URL}/auth/google/callback`
        : '/auth/google/callback',
    },
    function (accessToken, refreshToken, profile, done) {
      try {
        const googleId = profile.id;
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        const name = profile.displayName || null;
        const avatar =
          profile.photos && profile.photos[0] ? profile.photos[0].value : null;

        // Upsert: insert if not exists, then update
        db.prepare(
          'INSERT OR IGNORE INTO users (google_id, email, name, avatar) VALUES (?, ?, ?, ?)'
        ).run(googleId, email, name, avatar);

        db.prepare(
          'UPDATE users SET email = ?, name = ?, avatar = ? WHERE google_id = ?'
        ).run(email, name, avatar, googleId);

        const user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});

// GET /auth/google
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// GET /auth/google/callback
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  function (req, res) {
    res.redirect('/');
  }
);

// GET /auth/logout
router.get('/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) return next(err);
    res.redirect('/');
  });
});

// GET /auth/me
router.get('/me', function (req, res) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.user });
});

module.exports = router;
