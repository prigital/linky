// Builds the Express app. Deliberately does NOT call listen() and does NOT load
// dotenv, so the same app serves both server/index.js (local) and
// server/lambda.js (AWS).

const express = require('express');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const path = require('path');

const authRouter = require('./routes/auth');
const linksRouter = require('./routes/links');

function buildApp() {
  const app = express();

  // true, not 1: the request passes through CloudFront and then API Gateway, so
  // req.protocol must honour X-Forwarded-Proto across more than one hop.
  app.set('trust proxy', true);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // passport.session() is gone along with serializeUser/deserializeUser.
  // Passport is now only the OAuth handshake.
  app.use(passport.initialize());

  // Defence in depth: the CloudFront behaviours for these paths already use the
  // CachingDisabled policy.
  app.use(['/api', '/auth'], function (req, res, next) {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use('/auth', authRouter);
  app.use('/api/links', linksRouter);

  // Opt-in static serving for `npm start`. Gated on its own flag rather than
  // NODE_ENV, which is also 'production' in Lambda, where client/dist is not in
  // the bundle and CloudFront serves the SPA instead.
  if (process.env.SERVE_STATIC === 'true') {
    const distPath = path.join(__dirname, '..', 'client', 'dist');
    app.use(express.static(distPath));
    app.get('*', function (req, res) {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // JSON 404 so the client's `data.error` handling works on unmatched API paths.
  app.use(function (req, res) {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(function (err, req, res, next) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = buildApp;
