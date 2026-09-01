# Linky

Save and revisit your links. A small, keyboard-first bookmark app that runs
serverless on AWS for about the price of a coffee per month.

**Live at [linky.codenut.com](https://linky.codenut.com)**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Sign in with Google, save a URL with an optional title, notes and category,
then find it again by typing. Search and grouping happen as you type, and
every action has a keyboard path.

## Keyboard first

The app is designed to be driven without a mouse. The search box is focused on
load and refocused whenever the window regains focus, so you can switch to the
tab and start typing immediately.

| Key | Where | Action |
|---|---|---|
| *(type)* | Search | Filter by URL, title, notes or category |
| <kbd>↓</kbd> / <kbd>↑</kbd> | Search | Move through results |
| <kbd>Enter</kbd> | Search | Open the selected link in a new tab and clear the search |
| <kbd>+</kbd> | Search | Toggle the add-link form |
| <kbd>Esc</kbd> | Add form | Close the form |
| <kbd>↓</kbd> / <kbd>↑</kbd> | URL field | Move through autocomplete suggestions |
| <kbd>Enter</kbd> | URL field | Accept the highlighted suggestion |

The URL field autocompletes against a bundled list of 93 popular sites and
fills in the title for you.

> Contributions should preserve this. Any new interaction needs a keyboard
> path, not just a click handler.

## Architecture

```
                    ┌──────────── CloudFront ────────────┐
  Browser ─HTTPS──▶ │  *          →  S3 bucket (via OAC) │  ← React SPA
                    │  /api/*     ┐                      │
                    │  /auth/*    ┴→ HTTP API → Lambda   │  ← Express app
                    └────────────────────────────────────┘
                                        │
                                        ├── DynamoDB (single table)
                                        └── Secrets Manager (OAuth + JWT key)
```

One CloudFront distribution serves both the SPA and the API, so the client uses
relative URLs, cookies are same-origin, and **there is no CORS anywhere**.

- **Backend** — Node/Express (CommonJS) on Lambda (arm64, Node 22) behind an
  API Gateway HTTP API. One app, two entrypoints: `server/index.js` runs it
  locally, `server/lambda.js` wraps it for AWS.
- **Frontend** — React 18 + Vite, built to static files on S3.
- **Data** — DynamoDB, one table, on-demand billing.
- **Sessions** — a stateless signed JWT in an `HttpOnly` cookie. No session store.
- **Infrastructure** — AWS CDK (TypeScript) in `infra/`.

### A few deliberate choices

**Ownership is structural.** Items are keyed `pk = USER#<googleId>`, so a
cross-user read is not expressible rather than merely guarded by a `WHERE`
clause.

**Ordering needs no index.** Link sort keys are ULIDs, which sort
lexicographically by creation time, so a query with `ScanIndexForward: false`
returns newest-first with no GSI and no in-memory sort.

**Auth costs nothing to check.** The JWT carries only `{ sub }`, so the
authentication middleware performs zero database reads.

## Running locally

Requires Node 20+ and Docker (for DynamoDB Local).

```bash
npm install
npm --prefix client install

cp .env.example .env      # then fill in your Google OAuth credentials

npm run ddb               # start DynamoDB Local
npm run ddb:init          # create the table (idempotent)

npm run dev               # Vite on :5173, API on :3001
```

You will need a Google OAuth client with
`http://localhost:5173/auth/google/callback` registered as an authorized
redirect URI.

| Command | Does |
|---|---|
| `npm run dev` | Client and server together |
| `npm run server` | API only, port 3001 |
| `npm run client` | Vite only, proxies `/api` and `/auth` to the API |
| `npm run build` | Build the client to `client/dist/` |
| `npm run ddb` / `ddb:init` / `ddb:stop` | Local DynamoDB |

## Deploying

```bash
npm run infra:install
npm run infra:synth       # inspect the template
npm run deploy            # build the client, then cdk deploy
```

Before the first deploy:

1. **Create the secret.** One Secrets Manager secret holding
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `JWT_SECRET` as JSON keys,
   named `linky/prod` (override with `-c secretName=...`). The stack references
   it by name and never reads its value; the Lambda fetches it at cold start.
2. **Bootstrap two regions.** Your main region, and `us-east-1` — CloudFront
   requires its certificate there regardless of where the rest of the stack
   lives.
3. **Register the redirect URI.** After the first deploy, add the
   `GoogleRedirectUri` stack output to your Google OAuth client.

If you are deploying your own copy, override the domain defaults:

```bash
npm run deploy -- -c domainName=links.example.com -c hostedZoneId=Z... -c hostedZoneName=example.com
```

or pass `-c domainName=` to deploy without a custom domain and use the
CloudFront URL.

### Cost

At personal scale this is dominated by fixed costs — a Secrets Manager secret
and a Route 53 hosted zone — rather than traffic. Lambda, DynamoDB on-demand
and CloudFront are all effectively free at this volume. Expect a dollar or two
a month.

## Project layout

```
server/          Express app
  app.js         App factory (no listen, no dotenv) — shared by both entrypoints
  index.js       Local entrypoint
  lambda.js      AWS entrypoint
  config.js      Secret loading, memoized per execution environment
  session.js     JWT cookie sign/verify and requireAuth
  store/         DynamoDB access layer
  routes/        auth.js, links.js
client/          React 18 + Vite
infra/           AWS CDK app
  lib/           Stack definitions
  cloudfront/    Viewer-request functions (SPA routing, forwarded host)
```

`CLAUDE.md` documents the architecture in more depth, including deploy gotchas
worth reading before changing the CloudFront configuration.

## Contributing

Issues and pull requests welcome. Keep features keyboard-accessible, match the
existing style (2-space indent, semicolons, CommonJS backend, ES modules
frontend), and use short imperative commit subjects.

There is no automated test suite yet — see the open issues if you would like to
help change that.

## License

[MIT](LICENSE)

<!-- workflow auth verification: delete this branch after checking -->
