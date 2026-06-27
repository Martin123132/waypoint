# Privacy And Retention Notes

Waypoint is self-hosted. Operators control where the SQLite database lives, how long scan data is kept, and who can access the admin dashboard.

## What Waypoint Stores

Waypoint stores:

- Admin user email and password hash.
- Session records for signed-in admins.
- Domains added in the Domains panel.
- Link records, including title, destination URL, slug, note, QR colors, active state, and scan tracking state.
- Scan events for links with tracking enabled.

Scan events include:

- Event time.
- Referrer header when the browser sends one.
- User-agent-derived device class.
- User-agent-derived browser class.

Waypoint does not intentionally store full IP addresses in the application database.

## Scan Tracking Control

Scan tracking can be disabled per link. When tracking is off:

- Redirects still work.
- QR codes still resolve.
- New scan events are not written for that link.

Deleting a link removes that link record and its scan history through the database relationship.

## Retention

There is no automatic retention job in the MVP. Operators should choose a retention policy that fits their use case and jurisdiction.

Suggested operator policy:

- Keep scan events only as long as they are useful.
- Export or back up data only when needed.
- Delete links that are no longer active.
- Avoid importing private URLs or personal data into public demos, screenshots, examples, or issue reports.

## Public Reports And Proof Material

Use synthetic material for public reporting:

- Reserved demo domains such as `demo.example.test`, `go.example.test`, and `qr.example.test`.
- `example.com` destinations.
- Synthetic CSV rows.
- Screenshots generated from the removable synthetic demo.

Do not post secrets, credentials, cookies, production domains, private URLs, real QR payloads, customer data, personal data, private logs, or production databases.

## Admin Access

Admin APIs require a signed-in session. Public redirects remain open so QR codes and short links can work without dashboard access.

Operators should:

- Serve the dashboard over HTTPS.
- Use strong admin credentials.
- Restrict access to the host and database backups.
- Treat SQLite backups as sensitive operational data.
