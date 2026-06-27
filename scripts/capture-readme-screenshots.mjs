import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const cacheRoot = process.platform === 'win32' ? 'D:\\CodexCache' : join(tmpdir(), 'waypoint-cache')

process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.WAYPOINT_PLAYWRIGHT_BROWSERS_PATH ??
  process.env.OPENQR_PLAYWRIGHT_BROWSERS_PATH ??
  join(cacheRoot, 'playwright')

const { chromium } = await import('playwright')

const projectRoot = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const screenshotRoot = join(projectRoot, 'docs', 'assets')
const captureRoot = join(cacheRoot, 'waypoint', 'readme-screenshots')
const tempRoot = process.env.WAYPOINT_TEMP_ROOT ?? process.env.OPENQR_TEMP_ROOT ?? join(cacheRoot, 'tmp')
const profileRoot = join(cacheRoot, 'playwright-profiles')

mkdirSync(screenshotRoot, { recursive: true })
mkdirSync(captureRoot, { recursive: true })
mkdirSync(tempRoot, { recursive: true })
mkdirSync(profileRoot, { recursive: true })

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => {
        if (!address || typeof address === 'string') {
          reject(new Error('Could not allocate a screenshot port'))
          return
        }

        resolve(address.port)
      })
    })
  })
}

async function waitForHealth(port, child, getLogs) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early.\n${getLogs()}`)
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`)
      if (response.ok) {
        return
      }
    } catch {
      // Keep polling until the production server is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`Server did not become healthy.\n${getLogs()}`)
}

async function run() {
  const port = await getFreePort()
  const stamp = Date.now()
  const baseUrl = `http://127.0.0.1:${port}`
  const databasePath = join(captureRoot, `readme-demo-${stamp}.sqlite`)
  const profilePath = join(profileRoot, `readme-demo-${stamp}`)
  const child = spawn(process.execPath, ['dist-server/index.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      LOG_LEVEL: 'silent',
      WAYPOINT_DB: databasePath,
      WAYPOINT_DOMAIN_PROTOCOL: 'https',
      WAYPOINT_PORT: String(port),
      PORT: String(port),
      TEMP: tempRoot,
      TMP: tempRoot,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk
  })

  const getLogs = () => `stdout:\n${stdout}\nstderr:\n${stderr}`
  let browser

  try {
    await waitForHealth(port, child, getLogs)

    const setupResponse = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'demo@example.com', password: 'waypoint-password-123' }),
    })
    assert(setupResponse.ok, `Setup failed ${setupResponse.status}: ${await setupResponse.text()}`)

    const setCookie = setupResponse.headers.get('set-cookie')
    assert(setCookie, 'Setup did not return an auth cookie')
    const [name, ...valueParts] = setCookie.split(';')[0].split('=')
    const cookie = `${name}=${valueParts.join('=')}`

    const seedResponse = await fetch(`${baseUrl}/api/demo/seed`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie,
      },
      body: JSON.stringify({}),
    })
    assert(seedResponse.ok, `Demo seed failed ${seedResponse.status}: ${await seedResponse.text()}`)

    browser = await chromium.launchPersistentContext(profilePath, {
      headless: true,
      viewport: { width: 1440, height: 960 },
    })
    await browser.addCookies([{ name, value: valueParts.join('='), domain: '127.0.0.1', path: '/' }])

    const page = await browser.newPage()
    await page.addInitScript(() => {
      sessionStorage.setItem('waypoint_starter_tip_seen', '1')
    })

    await page.goto(`${baseUrl}#analytics`, { waitUntil: 'networkidle' })
    await page.getByText('Synthetic demo active').waitFor({ timeout: 10000 })
    const launchRouteButton = page.getByRole('button', { name: /Synthetic launch route/ })
    await launchRouteButton.waitFor({ timeout: 10000 })
    await launchRouteButton.click()
    await page.getByText('QR and link').waitFor({ timeout: 10000 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: join(screenshotRoot, 'waypoint-dashboard-demo.png'),
      fullPage: false,
    })

    await page.setViewportSize({ width: 390, height: 920 })
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.getByText('Synthetic demo active').waitFor({ timeout: 10000 })
    await page.getByRole('button', { name: /Synthetic launch route/ }).waitFor({ timeout: 10000 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: join(screenshotRoot, 'waypoint-mobile-demo.png'),
      fullPage: false,
    })

    console.log(`Captured README screenshots in ${screenshotRoot}`)
  } finally {
    if (browser) {
      await browser.close()
    }
    child.kill()
    await rm(profilePath, { recursive: true, force: true }).catch(() => undefined)
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
