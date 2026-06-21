import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import { join } from 'node:path'

const projectRoot = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const testRoot = process.env.WAYPOINT_TEST_ROOT ?? process.env.OPENQR_TEST_ROOT ?? 'D:\\CodexCache\\waypoint\\tests'
const tempRoot = process.env.WAYPOINT_TEMP_ROOT ?? process.env.OPENQR_TEMP_ROOT ?? 'D:\\CodexCache\\tmp'

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

function rawGet(port, path, hostHeader) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'GET',
        headers: hostHeader ? { Host: hostHeader } : undefined,
      },
      (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          body += chunk
        })
        response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }))
      },
    )

    request.on('error', reject)
    request.end()
  })
}

async function waitForHealth(port, child, getLogs) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
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
  const databasePath = join(testRoot, `domain-routing-${Date.now()}.sqlite`)
  const child = spawn(process.execPath, ['dist-server/index.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      LOG_LEVEL: 'silent',
      OPENQR_DB: join(testRoot, `legacy-domain-routing-${Date.now()}.sqlite`),
      OPENQR_DOMAIN_PROTOCOL: 'https',
      OPENQR_PORT: '1',
      WAYPOINT_DB: databasePath,
      WAYPOINT_DOMAIN_PROTOCOL: 'http',
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
  let lastSetCookie = []

  async function api(path, options = {}) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...options.headers,
      },
    })
    const setCookie = response.headers.get('set-cookie')
    lastSetCookie = setCookie ? setCookie.split(/,(?=\s*[^;,]+=)/).map((value) => value.trim()) : []
    if (setCookie) {
      cookie = setCookie.split(';')[0]
    }

    const text = await response.text()
    let payload = text
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      // Some endpoints intentionally return CSV or an empty body.
    }

    if (!response.ok && response.status !== 207) {
      throw new Error(`${options.method ?? 'GET'} ${path} failed ${response.status}: ${text}`)
    }

    return { response, payload }
  }

  try {
    await waitForHealth(port, child, getLogs)

    const root = await rawGet(port, '/', `127.0.0.1:${port}`)
    assert(root.status === 200 && root.body.includes('<div id="root">'), `SPA root returned ${root.status}`)

    const appFallback = await rawGet(port, '/dashboard-preview', `127.0.0.1:${port}`)
    assert(appFallback.status === 200 && appFallback.body.includes('<div id="root">'), `SPA fallback returned ${appFallback.status}`)

    const unknownHost = await rawGet(port, '/campaign', `unknown.localhost:${port}`)
    assert(unknownHost.status === 404, `Unknown branded host returned ${unknownHost.status}`)
    assert(unknownHost.body.includes('branded domain'), 'Unknown branded host did not explain the miss')

    await api('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@example.com', password: 'password123' }),
    })
    assert(cookie.startsWith('waypoint_session='), 'Setup did not return a Waypoint admin session cookie')
    const legacyCookie = cookie.replace(/^waypoint_session=/, 'openqr_session=')
    cookie = legacyCookie
    const legacyAuth = await api('/api/auth/me')
    assert(legacyAuth.payload.authenticated === true, 'Legacy OpenQR session cookie was not accepted')
    cookie = legacyCookie.replace(/^openqr_session=/, 'waypoint_session=')

    const domainResult = await api('/api/domains', {
      method: 'POST',
      body: JSON.stringify({ hostname: `brand.localhost:${port}`, label: 'Brand path', isPrimary: true }),
    })
    assert(domainResult.payload.hostname === `brand.localhost:${port}`, 'Domain hostname was not stored')
    assert(domainResult.payload.isPrimary === true, 'Domain was not marked primary')

    const linkResult = await api('/api/links', {
      method: 'POST',
      body: JSON.stringify({ title: 'Domain Link', destination: 'https://example.com/domain', slug: 'domain-link' }),
    })
    const link = linkResult.payload
    assert(link.domainId === domainResult.payload.id, 'New link did not inherit the primary domain')
    assert(link.shortUrl === `http://brand.localhost:${port}/domain-link`, `Unexpected branded URL: ${link.shortUrl}`)
    assert(link.fallbackUrl === `http://127.0.0.1:${port}/r/domain-link`, `Unexpected fallback URL: ${link.fallbackUrl}`)

    const brandedRedirect = await rawGet(port, '/domain-link', `brand.localhost:${port}`)
    assert(brandedRedirect.status === 302, `Branded redirect returned ${brandedRedirect.status}`)
    assert(brandedRedirect.headers.location === 'https://example.com/domain', `Branded redirect target was ${brandedRedirect.headers.location}`)

    const fallbackRedirect = await rawGet(port, '/r/domain-link', `127.0.0.1:${port}`)
    assert(fallbackRedirect.status === 302, `Fallback redirect returned ${fallbackRedirect.status}`)
    assert(fallbackRedirect.headers.location === 'https://example.com/domain', `Fallback redirect target was ${fallbackRedirect.headers.location}`)

    const csv = await api('/api/export/links.csv')
    assert(String(csv.payload).includes(`brand.localhost:${port}`), 'CSV export did not include the domain hostname')
    assert(String(csv.payload).includes(`http://brand.localhost:${port}/domain-link`), 'CSV export did not include the branded URL')

    await api('/api/auth/logout', { method: 'POST' })
    assert(
      lastSetCookie.some((value) => value.startsWith('waypoint_session=;')),
      'Logout did not clear the Waypoint session cookie',
    )
    assert(
      lastSetCookie.some((value) => value.startsWith('openqr_session=;')),
      'Logout did not clear the legacy OpenQR session cookie',
    )
    assert(cookie === 'waypoint_session=', 'Logout did not reset the stored test cookie')

    const login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@example.com', password: 'password123' }),
    })
    assert(login.payload.authenticated === true, 'Login did not restore the admin session')
    assert(cookie.startsWith('waypoint_session='), 'Login did not issue a Waypoint session cookie')

    const form = new FormData()
    form.append(
      'file',
      new Blob(['title,destination,slug,domain\nBad Domain,https://example.com/bad,bad,missing.localhost\n'], {
        type: 'text/csv',
      }),
      'links.csv',
    )
    const importResult = await api('/api/import/links.csv', { method: 'POST', body: form })
    assert(importResult.response.status === 207, `Unknown-domain import returned ${importResult.response.status}`)
    assert(importResult.payload.skipped === 1, 'Unknown-domain import row was not skipped')

    console.log(`domain-routing ok: http://brand.localhost:${port}/domain-link`)
  } finally {
    child.kill('SIGTERM')
    await new Promise((resolve) => child.once('exit', resolve))
  }
}

await run()
