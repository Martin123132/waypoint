# Waypoint

[![CI](https://github.com/Martin123132/waypoint/actions/workflows/ci.yml/badge.svg)](https://github.com/Martin123132/waypoint/actions/workflows/ci.yml)

Waypoint is a self-hosted dynamic QR code and short-link manager. Create a short URL, download a QR code, change the destination later, and keep basic scan analytics in a local SQLite database.

## Current MVP

- Dynamic short links at `/r/:slug`
- Editable destination URLs
- SVG QR generation and download
- Basic scan analytics by link
- CSV export for managed links
- CSV import with row-level errors
- Bulk QR ZIP export with SVG files and a CSV manifest
- Custom branded domains with app fallback URLs
- First-run admin setup
- Password login with HttpOnly session cookie
- Protected admin APIs with public redirects
- SQLite storage using Node 24's built-in `node:sqlite`
- React dashboard with desktop and mobile layouts
- Docker-ready production build

## Local Development

This project was created under `D:\CodexWork\openqr`. To keep package cache and temp files off `C:`, set these variables before running install/dev commands:

```powershell
$env:TEMP='D:\CodexCache\temp'
$env:TMP='D:\CodexCache\temp'
$env:npm_config_cache='D:\CodexCache\npm'
$env:npm_config_userconfig='D:\CodexCache\npm\npmrc'
$env:PLAYWRIGHT_BROWSERS_PATH='D:\CodexCache\playwright'
```

Install and run. Use `npm ci` for a lockfile-clean checkout; use `npm install` when intentionally updating dependencies.

```powershell
npm ci
npm run dev
```

The API defaults to `http://127.0.0.1:4040`. Vite will print the dashboard URL, usually `http://127.0.0.1:5173/` unless that port is already occupied.

## Production

```powershell
npm run build
npm start
```

Optional environment variables:

Waypoint uses `WAYPOINT_*` names for new installs. Existing `OPENQR_*` variables still work as fallbacks so older deployments do not break.

- `PORT`: host-provided API/web port override; takes precedence over `WAYPOINT_PORT`
- `WAYPOINT_PORT`: API/web port, default `4040`
- `HOST`: bind host, default `127.0.0.1`
- `WAYPOINT_DB`: SQLite database path, default `./data/waypoint.sqlite`
- `WAYPOINT_PUBLIC_URL`: public origin embedded into generated QR codes
- `WAYPOINT_DOMAIN_PROTOCOL`: protocol for branded short URLs, default follows the request origin
- `WAYPOINT_COOKIE_SECURE`: set to `1` behind HTTPS

On first launch, Waypoint asks you to create the admin account. After that, link management, analytics, QR downloads, and CSV export require a login session. Public redirects at `/r/:slug` stay open.

## Custom Domains

Custom domains let a link use `https://go.example.com/spring` while keeping the app fallback at `/r/spring`.

1. Point a DNS record for the branded host, such as `go.example.com`, at the server or reverse proxy that serves Waypoint.
2. Configure the reverse proxy to forward that hostname to the Waypoint process without rewriting the `Host` header.
3. Set `WAYPOINT_PUBLIC_URL` to the admin app origin, for example `https://qr.example.com`.
4. Set `WAYPOINT_DOMAIN_PROTOCOL=https` when branded domains are served over TLS.
5. Sign in, open the Domains panel, add `go.example.com`, and mark it primary if new links should use it by default.

When a request arrives for a registered branded host, Waypoint resolves `/:slug` against links assigned to that domain. When a request arrives on the app host, unknown routes fall back to the React app. Unknown branded hosts return a plain 404 so mistakes are obvious.

## Docker

```powershell
docker compose up --build
```

Then open `http://localhost:4040`.

The compose file stores SQLite data in the `waypoint-data` named volume and sets `WAYPOINT_PUBLIC_URL` for local access. Set `WAYPOINT_COOKIE_SECURE=1` when serving through HTTPS.

## API

- `GET /api/health`
- `GET /api/auth/me`
- `POST /api/auth/setup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/domains`
- `POST /api/domains`
- `PATCH /api/domains/:id`
- `DELETE /api/domains/:id`
- `GET /api/links`
- `POST /api/links`
- `PATCH /api/links/:id`
- `DELETE /api/links/:id`
- `GET /api/links/:id/events`
- `GET /api/links/:id/qr.svg`
- `POST /api/import/links.csv`
- `GET /api/export/links.csv`
- `GET /api/export/qr.zip`
- `GET /r/:slug`
- `GET /:slug` on registered branded domains

## CSV Import

Upload a CSV from the dashboard's Bulk run panel. Supported columns:

```csv
title,destination,slug,domain,description,active,qrForeground,qrBackground
Launch page,https://example.com,launch,go.example.com,Campaign owner,true,#071318,#ffffff
```

Only `destination` is strictly required. If `title` is missing, Waypoint will derive one from the slug or URL. If `domain` is present, it must already exist in the Domains panel; invalid rows are skipped and reported without blocking the rest of the file. Imports are limited to 500 rows per file.

## Verification

```powershell
npm run verify
```

`npm run verify` runs lint, the production build, the domain-routing integration test, and the guided UI test. For narrower checks, use `npm run lint`, `npm run build`, `npm run test:domain`, or `npm run test:ui`.

`npm test` runs the production build and then the domain-routing integration test. The test starts Waypoint on an isolated local port and writes its temporary SQLite database under `D:\CodexCache\waypoint\tests` by default. Override with `WAYPOINT_TEST_ROOT` and `WAYPOINT_TEMP_ROOT` if needed. The older `OPENQR_TEST_ROOT` and `OPENQR_TEMP_ROOT` names still work as fallbacks.

`npm run test:ui` runs the guided product path in Chromium against the built production server: first code, branded domain, apply primary domain, copy/share, and desktop/mobile overflow checks. Browser binaries default to `D:\CodexCache\playwright`; override with `WAYPOINT_PLAYWRIGHT_BROWSERS_PATH` if needed. Install them with:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='D:\CodexCache\playwright'
npx playwright install chromium
```

## Roadmap

- API keys
- Team accounts
- UTM builder
- Privacy controls for analytics retention

## Project Docs

- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Project Status](PROJECT_STATUS.md)
- [Synthetic routing demo](examples/synthetic-routing-demo.json)
- [Release review outcome template](docs/release-review-outcome-template.md)
- Issue templates:
  [domain routing](.github/ISSUE_TEMPLATE/domain-routing.yml),
  [guided UI/QR flow](.github/ISSUE_TEMPLATE/guided-ui-qr-flow.yml),
  [privacy or security-sensitive report](.github/ISSUE_TEMPLATE/privacy-security-sensitive.yml),
  [release readiness review](.github/ISSUE_TEMPLATE/release-review.yml)

## License

MIT
