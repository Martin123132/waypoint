import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))

const requiredFiles = [
  'README.md',
  'LICENSE',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'PROJECT_STATUS.md',
  'docs/release-review-outcome-template.md',
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
assertIncludes('README.md', '[Release review outcome template](docs/release-review-outcome-template.md)')
assertIncludes('README.md', '.github/ISSUE_TEMPLATE/domain-routing.yml')
assertIncludes('README.md', '.github/ISSUE_TEMPLATE/guided-ui-qr-flow.yml')
assertIncludes('README.md', '.github/ISSUE_TEMPLATE/privacy-security-sensitive.yml')
assertIncludes('README.md', '.github/ISSUE_TEMPLATE/release-review.yml')

assertIncludes('PROJECT_STATUS.md', 'Public Issue Intake')
assertIncludes('PROJECT_STATUS.md', 'synthetic domains, URLs, screenshots, and CSV rows')
assertIncludes('PROJECT_STATUS.md', 'Do not post secrets')
assertIncludes('PROJECT_STATUS.md', 'Release Readiness')
assertIncludes('PROJECT_STATUS.md', 'npm run verify')
assertIncludes('PROJECT_STATUS.md', 'synthetic-only proof material')
assertIncludes('PROJECT_STATUS.md', 'docs/release-review-outcome-template.md')
assertIncludes('PROJECT_STATUS.md', 'GitHub Actions CI URL')

assertIncludes('SECURITY.md', 'GitHub private vulnerability reporting')
assertIncludes('SECURITY.md', 'avoid posting exploit details')
assertIncludes('SECURITY.md', 'synthetic data')
assertIncludes('SECURITY.md', 'Please do not submit live credentials')

assertIncludes('LICENSE', 'MIT License')
assertIncludes('LICENSE', 'Permission is hereby granted, free of charge')

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
assertIncludes('.github/ISSUE_TEMPLATE/release-review.yml', 'MIT license is present')
assertIncludes('.github/ISSUE_TEMPLATE/release-review.yml', 'Examples use only `go.example.test`, `qr.example.test`, and `example.com` payloads.')
assertIncludes('.github/ISSUE_TEMPLATE/release-review.yml', 'real QR payloads')
assertIncludes('.github/ISSUE_TEMPLATE/release-review.yml', 'production domains')

assertIncludes('docs/release-review-outcome-template.md', 'does not create a release, tag, package, deployment, or announcement')
assertIncludes('docs/release-review-outcome-template.md', 'Local verification command: `npm run verify`')
assertIncludes('docs/release-review-outcome-template.md', 'Public readiness command: `npm run test:readiness`')
assertIncludes('docs/release-review-outcome-template.md', 'Synthetic examples command: `npm run test:examples`')
assertIncludes('docs/release-review-outcome-template.md', 'GitHub Actions CI URL: `https://github.com/Martin123132/waypoint/actions/runs/<run-id>`')
assertIncludes('docs/release-review-outcome-template.md', 'MIT/open source confirmed')
assertIncludes('docs/release-review-outcome-template.md', 'SECURITY.md')
assertIncludes('docs/release-review-outcome-template.md', 'No real QR payloads in proof material')
assertIncludes('docs/release-review-outcome-template.md', 'No private URLs in proof material')
assertIncludes('docs/release-review-outcome-template.md', 'No secrets, credentials, cookies, tokens, or API keys in proof material')
assertIncludes('docs/release-review-outcome-template.md', 'No production domains in proof material')
assertIncludes('docs/release-review-outcome-template.md', 'No datasets, customer data, personal data, internal logs, private screenshots, or proprietary material')
assertIncludes('docs/release-review-outcome-template.md', 'reserved/fake domains and `example.com` payloads')

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
  'open source software. Security fixes',
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
