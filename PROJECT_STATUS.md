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

