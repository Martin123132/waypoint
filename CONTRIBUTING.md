# Contributing to Waypoint

Thanks for helping make dynamic QR links boringly free.

## Local Setup

Waypoint requires Node.js 24 or newer.

```powershell
npm ci
npm run dev
```

The app uses SQLite. Keep local databases, `.env` files, screenshots, and generated artifacts out of commits.

## Verification

Run the full project check before opening a pull request:

```powershell
npm run verify
```

For narrower checks:

```powershell
npm run lint
npm run build
npm run test:domain
npm run test:ui
```

## Pull Requests

- Keep changes focused and explain the user-facing impact.
- Add or update tests for behavior changes.
- Do not commit secrets, private URLs, customer data, local SQLite databases, generated build output, or dependency folders.
- Preserve backward compatibility for existing `OPENQR_*` environment variables unless a migration plan is documented.

