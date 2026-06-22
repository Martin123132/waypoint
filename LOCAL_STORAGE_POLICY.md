# Local Storage Policy

Waypoint development on this machine keeps generated files, caches, browsers, test databases, screenshots, and dry-run evidence off the Windows `C:` drive.

## Windows Defaults

Use D-drive paths for local generated material:

- Workspace: `D:\CodexWork\openqr`
- Package cache: `D:\CodexCache\npm`
- Temp files: `D:\CodexCache\temp`
- Playwright browsers: `D:\CodexCache\playwright`
- Test databases: `D:\CodexCache\waypoint\tests`
- Local dry-run evidence: `outputs/`, ignored by git

Use the D-drive wrapper for local Windows commands when you want the cache/test environment set for the child process automatically:

```powershell
npm run ci:d-drive
npm run dev:d-drive
npm run verify:d-drive
```

## Repository Rules

- Do not commit absolute C drive paths.
- Do not commit generated databases, browser profiles, build output, dependency folders, logs, screenshots, or dry-run evidence.
- Keep `.env`, `.env.*`, `data/`, `dist/`, `dist-server/`, `node_modules/`, `outputs/`, and test output ignored.
- Linux CI may use runner temp paths such as `/tmp` or `$RUNNER_TEMP`; that does not change the Windows D-drive rule.

The policy is checked by `npm run test:storage` and the full `npm run verify` path. The D-drive command aliases are checked so local setup guidance does not drift.
