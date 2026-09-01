## What

<!-- One or two sentences on what this changes. -->

## Why

<!-- The problem it solves, or the issue it closes. -->

## How it was verified

<!--
There is no automated test suite yet, so say what you actually ran.
For infrastructure changes, include the output of `npm run infra:synth`
or `npm run infra:diff`.
-->

## Checklist

- [ ] Any new interaction has a keyboard path, not just a click handler
- [ ] Verified locally with `npm run dev`
- [ ] For infrastructure changes: `npm run infra:synth` still succeeds, and no
      `errorResponses` was added to the CloudFront distribution
- [ ] No secrets, credentials, or `.env` contents in the diff
