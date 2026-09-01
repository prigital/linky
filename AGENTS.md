# Repository Guidelines

## Project Structure & Module Organization
`linky` is a small monorepo with an Express backend and a Vite/React frontend.

- `server/` contains the Node app, the DynamoDB store, and route handlers. One Express app (`server/app.js`) with two entrypoints: `server/index.js` for local and `server/lambda.js` for AWS. See also `server/config.js`, `server/session.js`, `server/store/*.js`, and `server/routes/*.js`.
- `client/` contains the React app. App entry points live in `client/src/`, with page components under `client/src/pages/`.
- `infra/` contains the AWS CDK app (TypeScript) that deploys the stack, plus the two CloudFront Function sources under `infra/cloudfront/`.
- `scripts/` holds local development helpers, such as `create-local-table.sh` for DynamoDB Local.
- `CLAUDE.md` documents architecture, authentication, the DynamoDB key schema, deploy gotchas, environment variables, and the keyboard-first UX requirement.

## Build, Test, and Development Commands
- `npm install` installs root dependencies for the server.
- `npm --prefix client install` installs frontend dependencies.
- `npm run dev` starts both services for local development.
- `npm run server` runs the Express server on port `3001`.
- `npm run client` runs the Vite dev server and proxies `/api` and `/auth` to the backend.
- `npm run build` builds the frontend into `client/dist/`.
- `npm start` serves the production build through Express locally (`SERVE_STATIC=true`).
- `npm run ddb` / `npm run ddb:init` start DynamoDB Local and create the `linky-local` table.
- `npm run infra:install` installs CDK dependencies; `npm run infra:synth` and `npm run infra:diff` inspect the stack.
- `npm run deploy` builds the client and runs `cdk deploy`.

## Coding Style & Naming Conventions
- Use 2-space indentation and semicolons, matching the existing JS and JSX files.
- Backend code is CommonJS (`require`, `module.exports`); frontend code is ES modules with functional React components; infrastructure code is TypeScript CDK under `infra/`.
- Infrastructure is defined as code. Change the CDK stack rather than clicking in the console or running one-off CLI mutations.
- Do not use em dashes in AWS resource names or descriptions; use hyphens.
- Use `PascalCase` for React components (`Dashboard.jsx`), `camelCase` for functions and state, and lowercase route filenames (`auth.js`, `links.js`).
- Keep features keyboard-accessible. New UI behavior should include shortcut and focus handling, not only click interactions.

## Testing Guidelines
There is no automated test suite configured yet. Until one is added:

- smoke-test changes with `npm run dev` (start DynamoDB Local first: `npm run ddb && npm run ddb:init`);
- verify auth flows, link CRUD, and keyboard navigation manually;
- run `npm run infra:synth` after any infrastructure change, and confirm the template contains no `CustomErrorResponses` and that the `/api/*` and `/auth/*` behaviours still carry the `CachingDisabled` and `AllViewerExceptHostHeader` managed policies;
- if you add tests, keep them close to the code they cover and document the command in `package.json`.

## Commit & Pull Request Guidelines
- Follow the existing commit style: short, imperative subjects such as `Add URL autocomplete with popular sites list`.
- Keep commits focused on one change.
- PRs should explain user-visible behavior, note any env or schema changes, and include screenshots or short recordings for UI updates.
- Link related issues when applicable and list manual verification steps.

## Security & Configuration Tips
Copy `.env.example` to `.env` for local development. Never commit secrets.

In AWS, the Google OAuth credentials and the JWT signing key live in one
Secrets Manager secret. Reference that secret **by name only** and never read
its value. Do not pass secret values through Lambda environment variables with
`{{resolve:secretsmanager:...}}`: CloudFormation resolves those at deploy time,
storing the plaintext in the function configuration, and never picks up a
rotation. The Lambda fetches the secret itself at cold start.

Sessions are a stateless signed JWT in the `linky_session` cookie. There is no
session store, so nothing on disk needs to persist between requests.
