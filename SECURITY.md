# Security Policy

## Reporting a vulnerability

Please report security issues **privately** rather than opening a public issue.

Use GitHub's private vulnerability reporting on this repository:
<https://github.com/prigital/linky/security/advisories/new>

That channel is visible only to the maintainers.

Please include what you can:

- What the issue is and roughly how severe you think it is
- Steps to reproduce, or a proof of concept
- Which part of the system it affects — the Lambda API, the CDK
  infrastructure, the React client, or the auth flow

You should get an acknowledgement within a few days. This is a small hobby
project maintained in spare time, so please allow reasonable time for a fix
before disclosing publicly.

## Scope

In scope: the application code in this repository (`server/`, `client/`,
`infra/`) and its deployed instance at <https://linky.codenut.com>.

Out of scope: vulnerabilities in AWS, Google OAuth, or other third-party
services — report those to the relevant vendor.

## Known issues

Known security gaps are tracked as public issues. At present:

- Link URLs are not validated for scheme, so a direct API call can store a
  `javascript:` URL that the UI renders into a live link
- The OAuth flow does not use a `state` parameter

## Handling secrets

The Google OAuth credentials and the JWT signing key live in a single AWS
Secrets Manager secret. Reference it by name; never read its value into code,
logs, or configuration. In particular, do not pass secret values through Lambda
environment variables using `{{resolve:secretsmanager:...}}` — CloudFormation
resolves those at deploy time, which stores the plaintext in the function
configuration and never picks up a rotation. The Lambda fetches the secret
itself at cold start.
