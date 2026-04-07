require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const SQLiteStore = require('connect-sqlite3')(session);

const authRouter = require('./routes/auth');
const linksRouter = require('./routes/links');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust reverse proxy (needed for HTTPS cookies behind nginx/etc.)
app.set('trust proxy', 1);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.db', dir: '.' }),
    secret: process.env.SESSION_SECRET || 'fallback_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  })
);

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authRouter);
app.use('/api/links', linksRouter);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(distPath));
  app.get('*', function (req, res) {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, function () {
  console.log(`Linky server running on http://localhost:${PORT}`);
});
