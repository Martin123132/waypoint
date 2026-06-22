# Waypoint Project Status

## What This Is

Waypoint is a self-hosted dynamic QR code and short-link manager. It is intended to be a free, open-source alternative to subscription QR link services.

## Current Shape

- Public repo: `Martin123132/waypoint`
- Main branch: `main`
- Runtime: Node.js 24, Fastify, React, Vite, SQLite via `node:sqlite`
- License: MIT
- Verification: `npm run verify`
- CI: GitHub Actions runs the same verification path on pushes and pull requests

## Important Compatibility Notes

- New installs should use `WAYPOINT_*` environment variables.
- Existing `OPENQR_*` variables still work as fallbacks.
- New sessions use `waypoint_session`.
- Existing `openqr_session` cookies are still accepted during the rename transition.

## Public Issue Intake

GitHub issue forms are available for:

- Domain routing and branded-host bugs
- Guided UI, QR download, CSV, and mobile flow regressions
- Privacy or security-sensitive reports

Reports should use synthetic domains, URLs, screenshots, and CSV rows. Do not post secrets, private URLs, production QR payloads, cookies, credentials, personal data, customer data, or internal logs.

## Public Proof Fixtures

`examples/synthetic-routing-demo.json` documents a safe branded-domain and QR-flow scenario with reserved example domains and an `example.com` destination. It is checked by `npm run test:examples` and the full `npm run verify` path.

## Release Readiness

`.github/ISSUE_TEMPLATE/release-review.yml` provides a pre-release review checklist. It requires `npm run verify`, public readiness, the examples verifier, CI on `main`, MIT/open-source posture, and synthetic-only proof material. It does not create a release, tag, package, or deployment.

## Local Workspace Notes

The current local workspace is `D:\CodexWork\openqr`. Generated data and caches should stay on D: and remain uncommitted.

Ignored by design:

- `node_modules`
- `dist`
- `dist-server`
- `data`
- `.env`
- SQLite databases
- Playwright/test output
