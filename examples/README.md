# Waypoint Examples

This folder contains public-safe fixtures only. They are meant to demonstrate Waypoint behavior without exposing real QR payloads, private URLs, production domains, customer data, personal data, credentials, or logs.

## Synthetic Routing Demo

`synthetic-routing-demo.json` documents a complete branded-domain and QR-flow scenario using reserved example domains:

- App origin: `http://qr.example.test`
- Branded host: `http://go.example.test`
- Slug: `launch`
- QR payload: `http://go.example.test/launch`
- Redirect target: `https://example.com/waypoint-demo`
- Fallback URL: `http://qr.example.test/r/launch`

The fixture is checked by `npm run test:examples` and by the full `npm run verify` path.

