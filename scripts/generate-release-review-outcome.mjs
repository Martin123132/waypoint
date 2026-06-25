import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const outcome = `# Release Review Dry-Run Outcome

This is a public-safe dry-run outcome. It does not create a release, tag, package, deployment, or announcement.

## Review Scope

- Repository: \`Martin123132/waypoint\`
- Branch reviewed: \`main\`
- Candidate commit: \`<commit-sha>\`
- Reviewer: \`<public-safe name or handle>\`
- Review date: \`<YYYY-MM-DD>\`

## Verification Evidence

- Local verification command: \`npm run verify\`
- Local verification result: \`<pass/fail>\`
- Public readiness command: \`npm run test:readiness\`
- Public readiness result: \`<pass/fail>\`
- Synthetic examples command: \`npm run test:examples\`
- Synthetic examples result: \`<pass/fail>\`
- GitHub Actions CI URL: \`https://github.com/Martin123132/waypoint/actions/runs/<run-id>\`
- GitHub Actions CI result: \`<pass/fail>\`

## Synthetic Demo Evidence

- Demo fixture: \`examples/synthetic-routing-demo.json\`
- Demo walkthrough: \`examples/README.md\`
- Demo app origin: \`http://qr.example.test\`
- Demo branded host: \`http://go.example.test\`
- Demo QR payload: \`http://go.example.test/launch\`
- Demo redirect target: \`https://example.com/waypoint-demo\`
- Demo fallback route: \`http://qr.example.test/r/launch\`
- Demo status: \`<pass/fail>\`

## Source-Available And Security Posture

- License posture: PolyForm Noncommercial/source-available posture confirmed; commercial use requires a separate written license.
- Security guidance: \`SECURITY.md\` present and checked.
- Release review intake: \`.github/ISSUE_TEMPLATE/release-review.yml\` present and checked.
- Public readiness verifier: \`tests/public-readiness.test.mjs\` present and checked.
- Examples verifier: \`tests/examples.test.mjs\` present and checked.

## Proof-Material Privacy Confirmation

- No real QR payloads in proof material.
- No private URLs in proof material.
- No secrets, credentials, cookies, tokens, or API keys in proof material.
- No production domains in proof material.
- No datasets, customer data, personal data, internal logs, private screenshots, or proprietary material in proof material.
- Proof material uses only reserved/fake domains and \`example.com\` payloads.

## Outcome

- Release review outcome: \`<ready/not ready>\`
- Follow-up issue links: \`<public-safe links only>\`
- Notes: \`<public-safe summary only>\`
`

function outputPathFromArgs(args) {
  if (args.includes('--write')) {
    return join('outputs', 'release-review-dry-run.md')
  }

  const outIndex = args.indexOf('--out')
  if (outIndex !== -1) {
    const value = args[outIndex + 1]
    if (!value) {
      throw new Error('--out requires a file path')
    }

    return value
  }

  return null
}

const outputPath = outputPathFromArgs(process.argv.slice(2))

if (outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, outcome, 'utf8')
  process.stdout.write(`Wrote release review dry-run outcome to ${outputPath}\n`)
} else {
  process.stdout.write(outcome)
}
