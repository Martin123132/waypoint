# Deployment Guide

This guide covers a small production-style Waypoint deployment behind a reverse proxy. It uses example domains only.

## Build And Start

```powershell
npm ci
npm run build
npm start
```

Waypoint serves the API and built React dashboard from the same Node.js process.

Recommended environment variables:

```text
HOST=127.0.0.1
PORT=4040
WAYPOINT_DB=/var/lib/waypoint/waypoint.sqlite
WAYPOINT_PUBLIC_URL=https://qr.example.com
WAYPOINT_DOMAIN_PROTOCOL=https
WAYPOINT_COOKIE_SECURE=1
```

`WAYPOINT_PUBLIC_URL` should be the admin app origin. It is used when Waypoint builds fallback links and QR payloads.

## Reverse Proxy Shape

Use a reverse proxy such as Caddy, Nginx, Apache, Traefik, or a platform router to terminate TLS and forward traffic to the Waypoint process.

Required proxy behavior:

- Forward the original `Host` header.
- Forward `X-Forwarded-Host`.
- Forward `X-Forwarded-Proto`.
- Serve the admin app over HTTPS.
- Set `WAYPOINT_COOKIE_SECURE=1` when the public app uses HTTPS.

## Branded Domains

Waypoint supports two kinds of hostnames:

- Admin app host, for example `qr.example.com`
- Branded redirect host, for example `go.example.com`

For branded domains:

1. Point DNS for the branded host to the same reverse proxy.
2. Forward the branded hostname to the Waypoint process without rewriting `Host`.
3. Add the branded hostname in the Waypoint Domains panel.
4. Set `WAYPOINT_DOMAIN_PROTOCOL=https` when branded routes are served over TLS.

Requests to a registered branded host resolve `/:slug` against links assigned to that domain. Requests to the admin app host use `/r/:slug` as the fallback route.

## SQLite Storage

Set `WAYPOINT_DB` to a persistent disk path. Back up the SQLite database with the same care as any production application database.

Do not commit SQLite databases, `.env` files, screenshots with private URLs, or QR payloads from a real deployment.

## Pre-Release Deployment Check

Before sharing a deployment publicly:

- `npm run verify` passes locally.
- GitHub Actions CI is green on `main`.
- `WAYPOINT_PUBLIC_URL` matches the admin app origin.
- `WAYPOINT_COOKIE_SECURE=1` is set behind HTTPS.
- Branded domains preserve the original `Host` header.
- Proof screenshots and issue reports use synthetic domains and `example.com` payloads only.
