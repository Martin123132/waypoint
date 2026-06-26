import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const cacheRoot = process.platform === 'win32' ? 'D:\\CodexCache' : join(tmpdir(), 'waypoint-cache')
const projectRoot = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const testRoot = process.env.WAYPOINT_TEST_ROOT ?? process.env.OPENQR_TEST_ROOT ?? join(cacheRoot, 'waypoint', 'tests')
const tempRoot = process.env.WAYPOINT_TEMP_ROOT ?? process.env.OPENQR_TEMP_ROOT ?? join(cacheRoot, 'tmp')

mkdirSync(testRoot, { recursive: true })
mkdirSync(tempRoot, { recursive: true })

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
          reject(new Error('Could not allocate a test port'))
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
      // Keep polling until the server is ready or the deadline expires.
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`Server did not become healthy.\n${getLogs()}`)
}

async function run() {
  const port = await getFreePort()
  const databasePath = join(testRoot, `demo-seed-${Date.now()}.sqlite`)
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
  let cookie = ''

  async function api(path, options = {}) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...options.headers,
      },
    })
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      cookie = setCookie.split(';')[0]
    }

    const text = await response.text()
    let payload = text
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      // Keep non-JSON responses as text.
    }

    return { response, payload, text }
  }

  try {
    await waitForHealth(port, child, getLogs)

    const blocked = await api('/api/demo/seed', { method: 'POST', body: JSON.stringify({}) })
    assert(blocked.response.status === 401, `Unauthenticated demo seed returned ${blocked.response.status}`)

    const setup = await api('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ email: 'demo@example.com', password: 'password123' }),
    })
    assert(setup.response.ok, `Setup failed ${setup.response.status}: ${setup.text}`)

    const firstSeed = await api('/api/demo/seed', { method: 'POST', body: JSON.stringify({}) })
    assert(firstSeed.response.status === 201, `Demo seed returned ${firstSeed.response.status}: ${firstSeed.text}`)
    assert(firstSeed.payload.synthetic === true, 'Demo seed must mark its payload as synthetic')
    assert(firstSeed.payload.domain.hostname === 'demo.example.test', 'Demo seed must use reserved example.test domain')
    assert(firstSeed.payload.eventsSeeded === 9, `Expected 9 synthetic events, got ${firstSeed.payload.eventsSeeded}`)
    assert(firstSeed.payload.links.length === 2, `Expected 2 synthetic demo links, got ${firstSeed.payload.links.length}`)

    const launch = firstSeed.payload.links.find((link) => link.slug === 'demo-launch')
    const menu = firstSeed.payload.links.find((link) => link.slug === 'demo-menu')
    assert(launch, 'Demo launch link was not returned')
    assert(menu, 'Demo menu link was not returned')
    assert(launch.destination === 'https://example.com/waypoint-demo/launch', 'Launch destination must stay example.com-only')
    assert(menu.destination === 'https://example.com/waypoint-demo/menu', 'Menu destination must stay example.com-only')
    assert(launch.shortUrl === 'https://demo.example.test/demo-launch', `Unexpected demo branded URL: ${launch.shortUrl}`)
    assert(launch.fallbackUrl === `http://127.0.0.1:${port}/r/demo-launch`, `Unexpected fallback URL: ${launch.fallbackUrl}`)
    assert(menu.domainHostname === null, 'Demo menu route should remain fallback-only')
    assert(launch.scans === 6, `Expected 6 launch scans, got ${launch.scans}`)
    assert(menu.scans === 3, `Expected 3 menu scans, got ${menu.scans}`)

    const launchEvents = await api(`/api/links/${launch.id}/events`)
    assert(launchEvents.response.ok, `Launch analytics failed ${launchEvents.response.status}: ${launchEvents.text}`)
    assert(launchEvents.payload.events.length === 6, `Expected 6 launch events, got ${launchEvents.payload.events.length}`)
    assert(launchEvents.payload.daily.length > 0, 'Demo analytics should include daily buckets')
    assert(
      launchEvents.payload.events.every((event) => ['desktop', 'mobile', 'tablet'].includes(event.device)),
      'Demo analytics should use synthetic device classes only',
    )

    const secondSeed = await api('/api/demo/seed', { method: 'POST', body: JSON.stringify({}) })
    assert(secondSeed.response.status === 201, `Second demo seed returned ${secondSeed.response.status}: ${secondSeed.text}`)
    assert(secondSeed.payload.links.find((link) => link.slug === 'demo-launch')?.scans === 6, 'Second seed should refresh, not duplicate, launch scans')

    const links = await api('/api/links')
    assert(links.payload.length === 2, `Second seed should keep exactly 2 demo links, got ${links.payload.length}`)
    assert(links.payload.every((link) => link.destination.startsWith('https://example.com/')), 'Demo links must stay example.com-only')

    const remove = await api('/api/demo/seed', { method: 'DELETE' })
    assert(remove.response.ok, `Demo remove returned ${remove.response.status}: ${remove.text}`)
    assert(remove.payload.synthetic === true, 'Demo remove must mark its payload as synthetic')
    assert(remove.payload.linksRemoved === 2, `Expected 2 removed demo links, got ${remove.payload.linksRemoved}`)
    assert(remove.payload.eventsRemoved === 9, `Expected 9 removed demo events, got ${remove.payload.eventsRemoved}`)
    assert(remove.payload.domainRemoved === true, 'Unused synthetic demo domain should be removed')

    const emptyLinks = await api('/api/links')
    assert(emptyLinks.payload.length === 0, `Demo remove should leave no links, got ${emptyLinks.payload.length}`)

    const domains = await api('/api/domains')
    assert(
      domains.payload.every((domain) => domain.hostname !== 'demo.example.test'),
      'Demo remove should clear the unused synthetic domain',
    )
  } finally {
    child.kill()
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
