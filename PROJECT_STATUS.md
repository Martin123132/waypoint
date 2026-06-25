# Waypoint Project Status

## What This Is

Waypoint is a self-hosted dynamic QR code and short-link manager. It is intended to be a free, source-available alternative to subscription QR link services for personal and non-commercial use.

## Current Shape

- Public repo: `Martin123132/waypoint`
- Main branch: `main`
- Runtime: Node.js 24, Fastify, React, Vite, SQLite via `node:sqlite`
- License: PolyForm Noncommercial License 1.0.0; commercial use requires a separate written license
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

`.github/ISSUE_TEMPLATE/release-review.yml` provides a pre-release review checklist. It requires `npm run verify`, public readiness, the examples verifier, CI on `main`, source-available non-commercial license posture, and synthetic-only proof material. It does not create a release, tag, package, or deployment.

`docs/release-review-outcome-template.md` provides a dry-run evidence record for future release review outcomes. It records local verification, public readiness, examples verification, GitHub Actions CI URL, synthetic demo status, source-available non-commercial license posture, security guidance, and confirmation that proof material contains no real QR payloads, private URLs, secrets, production domains, datasets, or proprietary material.

`npm run release:review:dry-run` prints a sanitized release-review outcome with placeholder CI URL/result fields. Its checked sample is `docs/release-review-outcome.sample.md`.

`npm run release:review:write` writes the same dry-run report to `outputs/release-review-dry-run.md`. The `outputs/` directory is ignored and local-only unless a report is deliberately sanitized before sharing.

## Local Workspace Notes

The current local workspace is `D:\CodexWork\openqr`. Generated data and caches should stay on D: and remain uncommitted.

`LOCAL_STORAGE_POLICY.md` documents the D-drive storage rule. It is checked by `npm run test:storage` and the full `npm run verify` path.

Use `npm run ci:d-drive`, `npm run dev:d-drive`, or `npm run verify:d-drive` on Windows to launch those commands with D-drive cache, temp, Playwright, and test database paths.

Ignored by design:

- `node_modules`
- `dist`
- `dist-server`
- `data`
- `.env`
- SQLite databases
- Playwright/test output
