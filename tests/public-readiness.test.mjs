import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))

const requiredFiles = [
  'README.md',
  'LICENSE',
  'COMMERCIAL-LICENSE.md',
  'NOTICE.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'LOCAL_STORAGE_POLICY.md',
  'PROJECT_STATUS.md',
  'docs/deployment.md',
  'docs/privacy-retention.md',
  'docs/release-review-outcome-template.md',
  'docs/release-review-outcome.sample.md',
  'scripts/generate-release-review-outcome.mjs',
  '.github/workflows/ci.yml',
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/ISSUE_TEMPLATE/domain-routing.yml',
  '.github/ISSUE_TEMPLATE/guided-ui-qr-flow.yml',
  '.github/ISSUE_TEMPLATE/privacy-security-sensitive.yml',
  '.github/ISSUE_TEMPLATE/release-review.yml',
]

const publicReadinessFiles = [
  ...requiredFiles,
  '.env.example',
  'package.json',
]

const issueFormFiles = [
  '.github/ISSUE_TEMPLATE/domain-routing.yml',
  '.github/ISSUE_TEMPLATE/guided-ui-qr-flow.yml',
  '.github/ISSUE_TEMPLATE/privacy-security-sensitive.yml',
  '.github/ISSUE_TEMPLATE/release-review.yml',
]

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function readProjectFile(relativePath) {
  return readFileSync(join(projectRoot, relativePath), 'utf8')
}

function assertIncludes(file, expected) {
  const contents = readProjectFile(file)
  assert(contents.includes(expected), `${file} is missing: ${expected}`)
}

for (const file of requiredFiles) {
  assert(existsSync(join(projectRoot, file)), `Missing required public readiness file: ${file}`)
}

const workflow = readProjectFile('.github/workflows/ci.yml')
assert(workflow.includes('actions/checkout@v5'), 'CI workflow must use checkout v5')
assert(workflow.includes('actions/setup-node@v5'), 'CI workflow must use setup-node v5')
assert(workflow.includes('npm run verify'), 'CI workflow must run npm run verify')
assert(workflow.includes('node-version: 24'), 'CI workflow must use Node.js 24')
assert(workflow.includes('pull_request:'), 'CI workflow must run for pull requests')
assert(workflow.includes('contents: read'), 'CI workflow should use read-only contents permission')

const packageJson = JSON.parse(readProjectFile('package.json'))
assert(packageJson.scripts?.['test:readiness'] === 'node tests/public-readiness.test.mjs', 'package.json must expose test:readiness')
assert(
  packageJson.scripts?.verify?.includes('npm run test:readiness'),
  'npm run verify must include the public readiness check',
)

assertIncludes('README.md', '[![CI](https://github.com/Martin123132/waypoint/actions/workflows/ci.yml/badge.svg)]')
assertIncludes('README.md', '[Contributing](CONTRIBUTING.md)')
assertIncludes('README.md', '[Security Policy](SECURITY.md)')
assertIncludes('README.md', '[Project Status](PROJECT_STATUS.md)')
assertIncludes('README.md', '[Local Storage Policy](LOCAL_STORAGE_POLICY.md)')
assertIncludes('README.md', '[Deployment Guide](docs/deployment.md)')
assertIncludes('README.md', '[Privacy and Retention Notes](docs/privacy-retention.md)')
assertIncludes('README.md', '[COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)')
assertIncludes('README.md', '[Release review outcome template](docs/release-review-outcome-template.md)')
assertIncludes('README.md', '[Release review dry-run sample](docs/release-review-outcome.sample.md)')
assertIncludes('README.md', '.github/ISSUE_TEMPLATE/domain-routing.yml')
assertIncludes('README.md', '.github/ISSUE_TEMPLATE/guided-ui-qr-flow.yml')
assertIncludes('README.md', '.github/ISSUE_TEMPLATE/privacy-security-sensitive.yml')
assertIncludes('README.md', '.github/ISSUE_TEMPLATE/release-review.yml')

assertIncludes('PROJECT_STATUS.md', 'Public Issue Intake')
assertIncludes('PROJECT_STATUS.md', 'synthetic domains, URLs, screenshots, and CSV rows')
assertIncludes('PROJECT_STATUS.md', 'Do not post secrets')
assertIncludes('PROJECT_STATUS.md', 'Release Readiness')
assertIncludes('PROJECT_STATUS.md', 'docs/deployment.md')
assertIncludes('PROJECT_STATUS.md', 'docs/privacy-retention.md')
assertIncludes('PROJECT_STATUS.md', 'npm run verify')
assertIncludes('PROJECT_STATUS.md', 'synthetic-only proof material')
assertIncludes('PROJECT_STATUS.md', 'docs/release-review-outcome-template.md')
assertIncludes('PROJECT_STATUS.md', 'GitHub Actions CI URL')
assertIncludes('PROJECT_STATUS.md', 'LOCAL_STORAGE_POLICY.md')
assertIncludes('PROJECT_STATUS.md', 'npm run test:storage')
assertIncludes('PROJECT_STATUS.md', 'npm run release:review:dry-run')
assertIncludes('PROJECT_STATUS.md', 'npm run release:review:write')
assertIncludes('PROJECT_STATUS.md', 'docs/release-review-outcome.sample.md')
assertIncludes('PROJECT_STATUS.md', 'outputs/release-review-dry-run.md')
assertIncludes('PROJECT_STATUS.md', 'ignored and local-only')

assertIncludes('SECURITY.md', 'GitHub private vulnerability reporting')
assertIncludes('SECURITY.md', 'avoid posting exploit details')
assertIncludes('SECURITY.md', 'synthetic data')
assertIncludes('SECURITY.md', 'Please do not submit live credentials')

assertIncludes('docs/deployment.md', 'WAYPOINT_PUBLIC_URL=https://qr.example.com')
assertIncludes('docs/deployment.md', 'WAYPOINT_COOKIE_SECURE=1')
assertIncludes('docs/deployment.md', 'Forward the original `Host` header.')
assertIncludes('docs/deployment.md', 'WAYPOINT_DB=/var/lib/waypoint/waypoint.sqlite')
assertIncludes('docs/deployment.md', 'Do not commit SQLite databases')
assertIncludes('docs/deployment.md', 'Proof screenshots and issue reports use synthetic domains and `example.com` payloads only.')

assertIncludes('docs/privacy-retention.md', 'Waypoint does not intentionally store full IP addresses')
assertIncludes('docs/privacy-retention.md', 'Scan tracking can be disabled per link.')
assertIncludes('docs/privacy-retention.md', 'There is no automatic retention job in the MVP.')
assertIncludes('docs/privacy-retention.md', 'Screenshots generated from the removable synthetic demo.')
assertIncludes('docs/privacy-retention.md', 'Do not post secrets')
assertIncludes('docs/privacy-retention.md', 'Treat SQLite backups as sensitive operational data.')

assertIncludes('LICENSE', 'PolyForm Noncommercial License 1.0.0')
assertIncludes('LICENSE', 'Required Notice: waypoint is source-available for personal and non-commercial use')
assertIncludes('COMMERCIAL-LICENSE.md', 'No commercial license is granted unless agreed in writing by TWO HANDS NETWORK LTD.')
assertIncludes('NOTICE.md', 'TWO HANDS NETWORK LTD')

assertIncludes('.github/ISSUE_TEMPLATE/config.yml', 'blank_issues_enabled: false')
assertIncludes('.github/ISSUE_TEMPLATE/config.yml', 'https://github.com/Martin123132/waypoint/security/policy')

const issueTemplateNames = new Set(readdirSync(join(projectRoot, '.github/ISSUE_TEMPLATE')))
for (const file of issueFormFiles) {
  assert(issueTemplateNames.has(file.split('/').at(-1)), `Issue template is not listed on disk: ${file}`)
  assertIncludes(file, 'description:')
}

const combinedIssueForms = issueFormFiles.map(readProjectFile).join('\n')
const combinedIssueFormSafetyPhrases = [
  'synthetic',
  'Do not include',
  'Do not upload',
  'Do not post',
  'private',
  'secrets',
  'cookies',
  'personal data',
]

for (const phrase of combinedIssueFormSafetyPhrases) {
  assert(combinedIssueForms.toLowerCase().includes(phrase.toLowerCase()), `Issue forms are missing safety phrase: ${phrase}`)
}

for (const file of issueFormFiles) {
  const contents = readProjectFile(file)
  assert(contents.toLowerCase().includes('do not'), `${file} must include a public-safety "Do not" warning`)
}

assertIncludes('.github/ISSUE_TEMPLATE/release-review.yml', 'Opening this issue does not create a GitHub release')
assertIncludes('.github/ISSUE_TEMPLATE/release-review.yml', '`npm run verify` passes locally.')
assertIncludes('.github/ISSUE_TEMPLATE/release-review.yml', 'Public readiness check passes through `npm run test:readiness`.')
assertIncludes('.github/ISSUE_TEMPLATE/release-review.yml', 'Synthetic example verifier passes through `npm run test:examples`.')
assertIncludes('.github/ISSUE_TEMPLATE/release-review.yml', 'PolyForm Noncommercial license is present')
assertIncludes('.github/ISSUE_TEMPLATE/release-review.yml', 'Examples use only `go.example.test`, `qr.example.test`, and `example.com` payloads.')
assertIncludes('.github/ISSUE_TEMPLATE/release-review.yml', 'real QR payloads')
assertIncludes('.github/ISSUE_TEMPLATE/release-review.yml', 'production domains')

assertIncludes('docs/release-review-outcome-template.md', 'does not create a release, tag, package, deployment, or announcement')
assertIncludes('docs/release-review-outcome-template.md', 'Local verification command: `npm run verify`')
assertIncludes('docs/release-review-outcome-template.md', 'Public readiness command: `npm run test:readiness`')
assertIncludes('docs/release-review-outcome-template.md', 'Synthetic examples command: `npm run test:examples`')
assertIncludes('docs/release-review-outcome-template.md', 'GitHub Actions CI URL: `https://github.com/Martin123132/waypoint/actions/runs/<run-id>`')
assertIncludes('docs/release-review-outcome-template.md', 'PolyForm Noncommercial/source-available posture confirmed')
assertIncludes('docs/release-review-outcome-template.md', 'SECURITY.md')
assertIncludes('docs/release-review-outcome-template.md', 'No real QR payloads in proof material')
assertIncludes('docs/release-review-outcome-template.md', 'No private URLs in proof material')
assertIncludes('docs/release-review-outcome-template.md', 'No secrets, credentials, cookies, tokens, or API keys in proof material')
assertIncludes('docs/release-review-outcome-template.md', 'No production domains in proof material')
assertIncludes('docs/release-review-outcome-template.md', 'No datasets, customer data, personal data, internal logs, private screenshots, or proprietary material')
assertIncludes('docs/release-review-outcome-template.md', 'reserved/fake domains and `example.com` payloads')

assert(packageJson.scripts?.['release:review:dry-run'] === 'node scripts/generate-release-review-outcome.mjs', 'package.json must expose release:review:dry-run')
assert(packageJson.scripts?.['release:review:write'] === 'node scripts/generate-release-review-outcome.mjs --write', 'package.json must expose release:review:write')
assertIncludes('.gitignore', 'outputs')
assertIncludes('.dockerignore', 'outputs')
assertIncludes('README.md', 'npm run release:review:write')
assertIncludes('README.md', 'outputs/release-review-dry-run.md')
assertIncludes('README.md', 'ignored by git')
assertIncludes('README.md', 'deliberately sanitized')
assertIncludes('scripts/generate-release-review-outcome.mjs', 'does not create a release, tag, package, deployment, or announcement')
assertIncludes('scripts/generate-release-review-outcome.mjs', "join('outputs', 'release-review-dry-run.md')")
assertIncludes('scripts/generate-release-review-outcome.mjs', '--out requires a file path')
assertIncludes('scripts/generate-release-review-outcome.mjs', 'GitHub Actions CI URL')
assertIncludes('scripts/generate-release-review-outcome.mjs', 'PolyForm Noncommercial/source-available posture confirmed')
assertIncludes('scripts/generate-release-review-outcome.mjs', 'No real QR payloads in proof material')
assertIncludes('scripts/generate-release-review-outcome.mjs', 'No private URLs in proof material')
assertIncludes('scripts/generate-release-review-outcome.mjs', 'No secrets, credentials, cookies, tokens, or API keys in proof material')
assertIncludes('scripts/generate-release-review-outcome.mjs', 'No production domains in proof material')
assertIncludes('scripts/generate-release-review-outcome.mjs', 'Proof material uses only reserved/fake domains')
assertIncludes('docs/release-review-outcome.sample.md', 'This is a public-safe dry-run outcome')
assertIncludes('docs/release-review-outcome.sample.md', 'Local verification command: `npm run verify`')
assertIncludes('docs/release-review-outcome.sample.md', 'GitHub Actions CI URL: `https://github.com/Martin123132/waypoint/actions/runs/<run-id>`')
assertIncludes('docs/release-review-outcome.sample.md', 'Demo QR payload: `http://go.example.test/launch`')
assertIncludes('docs/release-review-outcome.sample.md', 'PolyForm Noncommercial/source-available posture confirmed')
assertIncludes('docs/release-review-outcome.sample.md', 'No datasets, customer data, personal data, internal logs, private screenshots, or proprietary material')

const generatedOutcome = execFileSync(process.execPath, [join(projectRoot, 'scripts/generate-release-review-outcome.mjs')], {
  encoding: 'utf8',
})
assert(
  generatedOutcome === readProjectFile('docs/release-review-outcome.sample.md'),
  'release-review dry-run generator output must match docs/release-review-outcome.sample.md',
)

const tempOutputRoot = mkdtempSync(join(tmpdir(), 'waypoint-release-review-'))
try {
  const tempOutputPath = join(tempOutputRoot, 'dry-run.md')
  const writeMessage = execFileSync(
    process.execPath,
    [join(projectRoot, 'scripts/generate-release-review-outcome.mjs'), '--out', tempOutputPath],
    { encoding: 'utf8' },
  )
  assert(writeMessage.includes(tempOutputPath), 'release-review dry-run writer should report the output path')
  assert(
    readFileSync(tempOutputPath, 'utf8') === readProjectFile('docs/release-review-outcome.sample.md'),
    'release-review dry-run writer output must match docs/release-review-outcome.sample.md',
  )
} finally {
  rmSync(tempOutputRoot, { recursive: true, force: true })
}

const secretPatterns = [
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  /\b(?:password|passwd|pwd|token|secret|api[_-]?key)\s*[:=]\s*['"]?[^'"\s]+/gi,
]

const allowedSecretLikeLines = [
  'Do not include secrets',
  'Do not post secrets',
  'without posting secrets',
  'source-available software. Security fixes',
]

for (const file of publicReadinessFiles) {
  const contents = readProjectFile(file)
  for (const pattern of secretPatterns) {
    for (const match of contents.matchAll(pattern)) {
      const lineStart = contents.lastIndexOf('\n', match.index) + 1
      const lineEnd = contents.indexOf('\n', match.index)
      const line = contents.slice(lineStart, lineEnd === -1 ? contents.length : lineEnd)
      const allowed = allowedSecretLikeLines.some((allowedLine) => line.includes(allowedLine))
      assert(allowed, `${file} contains a secret-looking string: ${line.trim()}`)
    }
  }
}

console.log('public-readiness ok')
