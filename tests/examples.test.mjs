import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const fixturePath = join(projectRoot, 'examples', 'synthetic-routing-demo.json')
const readmePath = join(projectRoot, 'examples', 'README.md')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function parseUrl(value, label) {
  try {
    return new URL(value)
  } catch {
    throw new Error(`${label} is not a valid URL: ${value}`)
  }
}

const fixtureText = readFileSync(fixturePath, 'utf8')
const fixture = JSON.parse(fixtureText)
const examplesReadme = readFileSync(readmePath, 'utf8')

assert(fixture.name === 'synthetic-routing-demo', 'Fixture name changed unexpectedly')
assert(fixture.privacy?.classification === 'synthetic', 'Fixture must be classified as synthetic')

const requiredSafetyPhrases = [
  'reserved example domains only',
  'placeholder QR payloads only',
  'Do not include secrets',
  'real QR payloads',
]

for (const phrase of requiredSafetyPhrases) {
  assert(fixtureText.includes(phrase), `Fixture is missing safety phrase: ${phrase}`)
}

const requiredReadmePhrases = [
  'public-safe fixtures only',
  'real QR payloads',
  'Walkthrough',
  'fake-domain only',
  'guided UI/detail panel',
  'QR preview or downloaded SVG',
  'fallback route',
  'Expected public-safe routing',
  'npm run test:examples',
  'npm run verify',
]

for (const phrase of requiredReadmePhrases) {
  assert(examplesReadme.includes(phrase), `examples/README.md is missing: ${phrase}`)
}

const appOrigin = parseUrl(fixture.appOrigin, 'appOrigin')
const destination = parseUrl(fixture.link.destination, 'link.destination')
const brandedShortUrl = parseUrl(fixture.expected.brandedShortUrl, 'expected.brandedShortUrl')
const fallbackShortUrl = parseUrl(fixture.expected.fallbackShortUrl, 'expected.fallbackShortUrl')
const qrPayload = parseUrl(fixture.expected.qrPayload, 'expected.qrPayload')
const redirectTarget = parseUrl(fixture.expected.redirectTarget, 'expected.redirectTarget')

assert(appOrigin.hostname === 'qr.example.test', 'App origin must use qr.example.test')
assert(fixture.domain.hostname === 'go.example.test', 'Branded host must use go.example.test')
assert(destination.hostname === 'example.com', 'Destination must use example.com')
assert(redirectTarget.href === destination.href, 'Redirect target must match link destination')

assert(brandedShortUrl.hostname === fixture.domain.hostname, 'Branded URL host must match domain hostname')
assert(brandedShortUrl.protocol === `${fixture.domain.protocol}:`, 'Branded URL protocol must match domain protocol')
assert(brandedShortUrl.pathname === `/${fixture.link.slug}`, 'Branded URL path must match slug')

assert(fallbackShortUrl.origin === appOrigin.origin, 'Fallback URL origin must match app origin')
assert(fallbackShortUrl.pathname === `/r/${fixture.link.slug}`, 'Fallback URL must use /r/:slug')

assert(qrPayload.href === brandedShortUrl.href, 'QR payload must encode the branded short URL')
assert(fixture.expected.redirectTarget === fixture.link.destination, 'Expected redirect target must match destination')

const readmeValuesFromFixture = [
  fixture.appOrigin,
  fixture.domain.hostname,
  fixture.link.title,
  fixture.link.slug,
  fixture.link.destination,
  fixture.expected.brandedShortUrl,
  fixture.expected.fallbackShortUrl,
  fixture.expected.qrPayload,
  fixture.expected.redirectTarget,
]

for (const value of readmeValuesFromFixture) {
  assert(examplesReadme.includes(value), `examples/README.md is missing fixture value: ${value}`)
}

for (const step of fixture.guidedFlow) {
  const importantWords = step
    .replaceAll('http://go.example.test/launch', '')
    .replaceAll('https://example.com/waypoint-demo', '')
    .replaceAll('go.example.test', '')
    .replaceAll('qr.example.test', '')
    .split(/\W+/)
    .filter((word) => word.length > 6)

  assert(
    importantWords.some((word) => examplesReadme.toLowerCase().includes(word.toLowerCase())),
    `examples/README.md appears to have drifted from guided flow step: ${step}`,
  )
}

const serialized = `${fixtureText}\n${examplesReadme}`
const forbiddenPatterns = [
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\b(?:password|passwd|pwd|token|secret|api[_-]?key)\s*[:=]\s*['"]?[^'"\s]+/gi,
]

for (const pattern of forbiddenPatterns) {
  const matches = [...serialized.matchAll(pattern)]
  for (const match of matches) {
    const lineStart = serialized.lastIndexOf('\n', match.index) + 1
    const lineEnd = serialized.indexOf('\n', match.index)
    const line = serialized.slice(lineStart, lineEnd === -1 ? serialized.length : lineEnd)
    const isSafetyText = line.includes('Do not include secrets')
    assert(isSafetyText, `Example contains a secret-looking string: ${line.trim()}`)
  }
}

console.log('examples ok')
