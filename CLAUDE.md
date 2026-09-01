# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Linky is a link-saving app ("Save and revisit your links") with Google OAuth authentication. Users log in with Google and can save, view, and delete URLs with optional titles and notes.

The app runs serverless on AWS: Lambda + API Gateway HTTP API for the backend, DynamoDB for storage, and S3 + CloudFront for the built SPA. CloudFront serves everything from a single origin, so the client uses relative URLs and there is no CORS anywhere.

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
npm start          # Run server locally with SERVE_STATIC=true (serves built client)
```

### Local DynamoDB
```bash
npm run ddb        # Start DynamoDB Local in Docker (port 8000)
npm run ddb:init   # Create the linky-local table (idempotent)
npm run ddb:stop   # Stop it
```

### Deploy
```bash
npm run infra:install   # Install CDK dependencies (once)
npm run infra:synth     # Synthesize the CloudFormation template
npm run infra:diff      # Diff against the deployed stack
npm run deploy          # Build the client, then cdk deploy
```

First deploy is two-phase, because the OAuth redirect URI needs the CloudFront
domain, which does not exist until the stack is up:

1. `npm run deploy`
2. Copy the `GoogleRedirectUri` stack output into **Authorized redirect URIs**
   on the Google OAuth client, and the `DistributionDomainName` into
   **Authorized JavaScript origins**.

No second deploy is needed: the Lambda derives its public origin from the
`x-forwarded-host` header that a CloudFront Function injects. Set the `APP_URL`
env var (or `-c appUrl=...`) only to override that.

### Dependencies
```bash
npm install                    # Root (server) deps
npm --prefix client install    # Client deps
```

## Architecture

The project is a monorepo with a Node/Express backend and a React (Vite) frontend:

- **`server/`** — Express app (CommonJS), one app with two entrypoints
  - `app.js` — Builds and returns the Express app. Does not call `listen()` and does not load dotenv, so it serves both local and Lambda.
  - `index.js` — Local entrypoint: loads dotenv, then `listen(PORT)`. The only place dotenv is required.
  - `lambda.js` — AWS entrypoint: pre-loads config, then wraps the app with `@codegenie/serverless-express`.
  - `config.js` — Memoized config loader. Reads Secrets Manager when `LINKY_SECRET_ID` is set, otherwise `process.env`.
  - `session.js` — Stateless session: signs, verifies, sets and clears the `linky_session` JWT cookie, and exports `requireAuth`.
  - `store/` — DynamoDB access layer. `client.js` holds the document client and key helpers; `index.js` exposes `getUserById`, `upsertUser`, `listLinks`, `createLink`, `updateLink`, `deleteLink`.
  - `routes/auth.js` — Passport Google OAuth strategy (`session: false`), `/auth/google`, `/auth/google/callback`, `/auth/logout`, `/auth/me`. Registers the strategy lazily because the client secret arrives asynchronously.
  - `routes/links.js` — CRUD for links (`GET`, `POST`, `PUT /:id`, `DELETE /:id`). All routes require authentication via the `requireAuth` middleware from `session.js`.

- **`infra/`** — AWS CDK app (TypeScript)
  - `lib/linky-stack.ts` — DynamoDB table, Lambda, HTTP API, S3 bucket, CloudFront distribution, bucket deployment, outputs.
  - `cloudfront/spa-rewrite.js` — Viewer-request function on the default behaviour; rewrites extensionless paths to `/index.html`.
  - `cloudfront/forwarded-host.js` — Viewer-request function on the API behaviours; copies `Host` into `x-forwarded-host`.

- **`client/`** — React 18 + Vite (ES modules)
  - `src/App.jsx` — Root component. Checks `GET /auth/me` on mount to determine auth state; renders `<Login>` or `<Dashboard>`.
  - `src/pages/Login.jsx` — Unauthenticated view.
  - `src/pages/Dashboard.jsx` — Authenticated view for managing links.
  - Vite proxies `/api` and `/auth` to `http://localhost:3001` in dev.

## Authentication

Sessions are **stateless**: a signed JWT in an `HttpOnly`, `SameSite=Lax`
cookie named `linky_session`, 7 day expiry, `Secure` when
`NODE_ENV=production`. There is no session store.

The token payload is only `{ sub: <google profile id> }`. Keeping it minimal
means the cookie carries no PII and `requireAuth` needs **zero** DynamoDB
reads. `/auth/me` does exactly one `GetItem` for the profile.

`SameSite=Lax` is correct for the Google callback: SameSite governs when a
cookie is *sent*, not when it is *set*, and the callback is a top-level GET
navigation.

Note there is still no OAuth `state` parameter. That was also true before the
migration (it required a session store), so it is not a regression, but it is a
real gap worth closing with a signed-cookie `StateStore`.

## Environment Variables

Copy `.env.example` to `.env`. Locally you need the Google OAuth credentials,
`SESSION_SECRET`, `APP_URL`, and the DynamoDB Local settings.

In AWS, CDK sets `LINKY_TABLE_NAME` and `LINKY_SECRET_ID` instead, and the
Lambda reads `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `JWT_SECRET` out of
that Secrets Manager secret at cold start.

**Secret handling:** reference the secret by *name* only. Never read its value,
and do not put secret values in Lambda environment variables via
`{{resolve:secretsmanager:...}}` — CloudFormation resolves those at deploy
time, which stores the plaintext in the function configuration and never picks
up a rotation.

## UX Philosophy

The app must be fully usable without a mouse. Every action (saving, editing, deleting links, navigating, searching) should be accessible via keyboard shortcuts. When adding new features, always consider and implement keyboard access alongside any mouse/click interactions.

## Data Storage

A single DynamoDB table, on-demand billing, keyed `pk` (S) / `sk` (S):

| Item | `pk` | `sk` | Attributes |
|---|---|---|---|
| Profile | `USER#<googleId>` | `PROFILE` | `google_id`, `email`, `name`, `avatar`, `created_at`, `updated_at` |
| Link | `USER#<googleId>` | `LINK#<ulid>` | `id`, `user_id`, `url`, `title`, `notes`, `category`, `created_at` |

No GSIs. Every access path is a `pk` equality plus either an exact `sk` or
`begins_with(sk, 'LINK#')`.

**Ordering:** a ULID's leading characters encode its millisecond timestamp, so
ULIDs sort lexicographically by creation time. `Query` with
`ScanIndexForward: false` returns newest-first with no GSI and no in-memory
sort.

**Ownership is structural.** Because `pk` *is* the user, a cross-user read or
write is not expressible — this replaces the old `WHERE ... AND user_id = ?`
guard rather than reimplementing it.

`GET /api/links` must keep returning the **entire** list in one response,
because search and category grouping are client-side. The store paginates the
Query, since a single page caps at 1 MB.

Link `id` is a 26-character ULID string, not an integer.

## Deploy Gotchas

**Never add `errorResponses` to the CloudFront distribution.** Custom error
responses are a distribution-level property and apply to *every* cache
behaviour, including `/api/*`. Mapping 403/404 to `/index.html` with status 200
would rewrite the API's legitimate `404 {"error":"Link not found"}` into an
HTML page with status 200, and the client's `res.ok` check would silently
report a failed delete as a success. SPA routing is handled by the
`spa-rewrite.js` CloudFront Function on the default behaviour only.

**Keep the `ALL_VIEWER_EXCEPT_HOST_HEADER` origin request policy on the API
behaviours.** It forwards all cookies while stripping `Host`, which API Gateway
rejects if it does not match its own domain. Do not switch it to `ALL_VIEWER`.

**Keep `CACHING_DISABLED` on the API behaviours**, or one user's authenticated
response can be served to another.
