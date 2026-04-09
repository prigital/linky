# Repository Guidelines

## Project Structure & Module Organization
`linky` is a small monorepo with an Express backend and a Vite/React frontend.

- `server/` contains the Node app, SQLite setup, and route handlers. Main files are `server/index.js`, `server/db.js`, and `server/routes/*.js`.
- `client/` contains the React app. App entry points live in `client/src/`, with page components under `client/src/pages/`.
- Runtime SQLite files such as `linky.db` and `sessions.db` are created at the repository root during local use.
- `CLAUDE.md` documents architecture, environment variables, and the keyboard-first UX requirement.

## Build, Test, and Development Commands
- `npm install` installs root dependencies for the server.
- `npm --prefix client install` installs frontend dependencies.
- `npm run dev` starts both services for local development.
- `npm run server` runs the Express server on port `3001`.
- `npm run client` runs the Vite dev server and proxies `/api` and `/auth` to the backend.
- `npm run build` builds the frontend into `client/dist/`.
- `npm start` serves the production build through Express.

## Coding Style & Naming Conventions
- Use 2-space indentation and semicolons, matching the existing JS and JSX files.
- Backend code is CommonJS (`require`, `module.exports`); frontend code is ES modules with functional React components.
- Use `PascalCase` for React components (`Dashboard.jsx`), `camelCase` for functions and state, and lowercase route filenames (`auth.js`, `links.js`).
- Keep features keyboard-accessible. New UI behavior should include shortcut and focus handling, not only click interactions.

## Testing Guidelines
There is no automated test suite configured yet. Until one is added:

- smoke-test changes with `npm run dev`;
- verify auth flows, link CRUD, and keyboard navigation manually;
- if you add tests, keep them close to the code they cover and document the command in `package.json`.

## Commit & Pull Request Guidelines
- Follow the existing commit style: short, imperative subjects such as `Add URL autocomplete with popular sites list`.
- Keep commits focused on one change.
- PRs should explain user-visible behavior, note any env or schema changes, and include screenshots or short recordings for UI updates.
- Link related issues when applicable and list manual verification steps.

## Security & Configuration Tips
Create a root `.env` with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, and optional `PORT`. Never commit secrets or generated `.db` files.
