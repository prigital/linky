# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Linky is a link-saving app ("Save and revisit your links") with Google OAuth authentication. Users log in with Google and can save, view, and delete URLs with optional titles and notes.

## Commands

### Development
```bash
npm run dev        # Start both server and client concurrently (recommended for dev)
npm run server     # Server only (port 3001)
npm run client     # Client only (Vite dev server, proxies /api and /auth to :3001)
```

### Production
```bash
npm run build      # Build client to client/dist/
npm start          # Run server in production mode (serves built client)
```

### Dependencies
```bash
npm install                    # Root (server) deps
npm --prefix client install    # Client deps
```

## Architecture

The project is a monorepo with a Node/Express backend and a React (Vite) frontend:

- **`server/`** — Express app (CommonJS)
  - `index.js` — App setup: session (SQLite store), Passport, routes. Serves `client/dist` in production.
  - `db.js` — Initializes `linky.db` (better-sqlite3) with `users` and `links` tables.
  - `routes/auth.js` — Passport Google OAuth strategy, serialize/deserialize, `/auth/google`, `/auth/google/callback`, `/auth/logout`, `/auth/me`.
  - `routes/links.js` — CRUD for links (`GET /api/links`, `POST /api/links`, `DELETE /api/links/:id`). All routes require authentication via `requireAuth` middleware.

- **`client/`** — React 18 + Vite (ES modules)
  - `src/App.jsx` — Root component. Checks `GET /auth/me` on mount to determine auth state; renders `<Login>` or `<Dashboard>`.
  - `src/pages/Login.jsx` — Unauthenticated view.
  - `src/pages/Dashboard.jsx` — Authenticated view for managing links.
  - Vite proxies `/api` and `/auth` to `http://localhost:3001` in dev.

## Environment Variables

Create a `.env` file in the project root:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...
PORT=3001          # optional, defaults to 3001
```

## Data Storage

- `linky.db` — SQLite database (auto-created at root on first run), stores `users` and `links`.
- `sessions.db` — SQLite session store (auto-created at root on first run).
- All link operations are scoped to `req.user.id` — users can only access their own links.
