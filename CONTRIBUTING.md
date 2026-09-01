# Contributing to Linky

Thanks for taking an interest. Issues and pull requests are welcome.

## Local setup

Requires Node 20+ and Docker (for DynamoDB Local).

```bash
npm install
npm --prefix client install
cp .env.example .env      # fill in your Google OAuth credentials
npm run ddb               # start DynamoDB Local
npm run ddb:init          # create the table (idempotent)
npm run dev               # Vite on :5173, API on :3001
```

You need a Google OAuth client with `http://localhost:5173/auth/google/callback`
registered as an authorized redirect URI.

## The one rule that is easy to miss

**Every feature must be usable without a mouse.** Keyboard access is the point
of this app, not a nicety. If you add an interaction, give it a keyboard path
and sensible focus handling — not just a click handler. A PR that adds a
mouse-only control will be asked to change.

The existing shortcuts are listed in the README.

## Style

- 2-space indentation, semicolons
- Backend (`server/`) is CommonJS: `require`, `module.exports`
- Frontend (`client/`) is ES modules with functional React components
- Infrastructure (`infra/`) is TypeScript CDK
- `PascalCase` for React components, `camelCase` for functions and state,
  lowercase route filenames
- Short, imperative commit subjects: `Add URL autocomplete`, not
  `added url autocomplete`

## Verifying a change

There is no automated test suite yet — this is a known gap and help closing it
is welcome. Until then, verify by hand:

- Run `npm run dev` and exercise the affected paths
- Check auth (log out, log in), link CRUD, and keyboard navigation
- After any infrastructure change, run `npm run infra:synth` and confirm the
  synthesized template still looks right

## Infrastructure changes, and one trap

`CLAUDE.md` documents the architecture in depth. Before touching the CloudFront
configuration, read its "Deploy Gotchas" section. The short version:

**Never add `errorResponses` to the CloudFront distribution.** Custom error
responses are a distribution-level property and apply to *every* cache
behaviour, including `/api/*`. Mapping 403/404 to `/index.html` with status 200
rewrites the API's legitimate `404 {"error":"Link not found"}` into an HTML page
with status 200, and the client's `res.ok` check then reports a failed delete as
a success. SPA routing is handled by a CloudFront Function on the default
behaviour only.

Two related invariants on the `/api/*` and `/auth/*` behaviours: keep the
`ALL_VIEWER_EXCEPT_HOST_HEADER` origin request policy (it forwards cookies while
stripping `Host`, which API Gateway rejects otherwise), and keep
`CACHING_DISABLED` (or one user's authenticated response can be served to
another).

## Deploying your own copy

The CDK app reads the domain and hosted zone from context, set in `cdk.json`.
Change those values to your own before deploying, or clear `domainName` to
deploy without a custom domain and use the CloudFront URL.

See the README's deploy section for the Secrets Manager secret and the two
regions that need bootstrapping.
