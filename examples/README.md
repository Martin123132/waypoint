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

## Walkthrough

This walkthrough is intentionally fake-domain only. Do not replace it with real QR payloads, production domains, private URLs, credentials, customer data, personal data, cookies, or logs.

1. Start Waypoint against a local or throwaway SQLite database.
2. Create the first admin account.
3. Add `go.example.test` as a branded domain and mark it primary.
4. Create a link titled `Example launch` with slug `launch`.
5. Set the destination to `https://example.com/waypoint-demo`.
6. Confirm the guided UI/detail panel shows the branded URL `http://go.example.test/launch`.
7. Confirm the QR preview or downloaded SVG encodes `http://go.example.test/launch`.
8. Confirm a request for `/launch` on `go.example.test` redirects to `https://example.com/waypoint-demo`.
9. Confirm the fallback route `http://qr.example.test/r/launch` remains available on the app host.

Expected public-safe routing:

| Surface | Expected value |
| --- | --- |
| Branded short URL | `http://go.example.test/launch` |
| QR payload | `http://go.example.test/launch` |
| Redirect target | `https://example.com/waypoint-demo` |
| Fallback URL | `http://qr.example.test/r/launch` |

## Verification

The fixture is checked by `npm run test:examples` and by the full `npm run verify` path.

```powershell
npm run test:examples
npm run verify
```
