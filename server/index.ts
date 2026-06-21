import staticPlugin from '@fastify/static'
import multipart from '@fastify/multipart'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import { parse as parseCsv } from 'csv-parse/sync'
import { customAlphabet, nanoid } from 'nanoid'
import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import QRCode from 'qrcode'
import { ZipFile } from 'yazl'
import { z } from 'zod'

function envValue(primary: string, fallback: string) {
  return process.env[primary] ?? process.env[fallback]
}

const port = Number(process.env.PORT ?? envValue('WAYPOINT_PORT', 'OPENQR_PORT') ?? 4040)
const host = process.env.HOST ?? '127.0.0.1'
const databasePath = envValue('WAYPOINT_DB', 'OPENQR_DB') ?? join(process.cwd(), 'data', 'waypoint.sqlite')
const shortId = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 8)
const sessionCookieName = 'waypoint_session'
const legacySessionCookieName = 'openqr_session'
const sessionDurationMs = 30 * 24 * 60 * 60 * 1000

mkdirSync(dirname(databasePath), { recursive: true })

const db = new DatabaseSync(databasePath)
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS domains (
    id TEXT PRIMARY KEY,
    hostname TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    isPrimary INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    domainId TEXT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    destination TEXT NOT NULL,
    description TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    qrForeground TEXT NOT NULL DEFAULT '#071318',
    qrBackground TEXT NOT NULL DEFAULT '#ffffff',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    linkId TEXT NOT NULL,
    occurredAt TEXT NOT NULL,
    referrer TEXT,
    userAgent TEXT,
    device TEXT NOT NULL,
    browser TEXT NOT NULL,
    FOREIGN KEY (linkId) REFERENCES links(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS events_link_time_idx ON events(linkId, occurredAt);

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    passwordSalt TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    tokenHash TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(tokenHash);
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expiresAt);
`)

try {
  db.exec('ALTER TABLE links ADD COLUMN domainId TEXT')
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes('duplicate column name')) {
    throw error
  }
}

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
})

await app.register(multipart, {
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
  },
})

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)

const createLinkSchema = z.object({
  title: z.string().trim().min(1).max(120),
  destination: z.string().trim().url().max(2048),
  slug: z.string().trim().max(64).optional(),
  domainId: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(240).optional(),
  qrForeground: hexColor.optional(),
  qrBackground: hexColor.optional(),
})

const updateLinkSchema = createLinkSchema.partial().extend({
  active: z.boolean().optional(),
})

const csvImportRowSchema = z.object({
  title: z.string().trim().min(1).max(120),
  destination: z.string().trim().url().max(2048),
  slug: z.string().trim().max(64).optional(),
  domainId: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(240).optional(),
  active: z.boolean().optional(),
  qrForeground: hexColor.optional(),
  qrBackground: hexColor.optional(),
})

const setupSchema = z.object({
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(200),
})

const loginSchema = setupSchema

const domainSchema = z.object({
  hostname: z.string().trim().min(3).max(253),
  label: z.string().trim().max(80).optional(),
  isPrimary: z.boolean().optional(),
})

type LinkRow = {
  id: string
  domainId: string | null
  slug: string
  title: string
  destination: string
  description: string | null
  active: number
  qrForeground: string
  qrBackground: string
  createdAt: string
  updatedAt: string
}

type LinkSummaryRow = LinkRow & {
  domainHostname: string | null
  domainLabel: string | null
  scans: number
  scans24: number
}

type DomainRow = {
  id: string
  hostname: string
  label: string
  status: string
  isPrimary: number
  createdAt: string
  updatedAt: string
}

type EventRow = {
  id: string
  linkId: string
  occurredAt: string
  referrer: string | null
  userAgent: string | null
  device: string
  browser: string
}

type DailyRow = {
  date: string
  scans: number
}

type UserRow = {
  id: string
  email: string
  passwordHash: string
  passwordSalt: string
  createdAt: string
  updatedAt: string
}

type SessionUserRow = {
  sessionId: string
  userId: string
  email: string
  expiresAt: string
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeSlug(input?: string) {
  const slug = (input ?? '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  return slug || shortId()
}

function normalizeHostname(input: string) {
  const trimmed = input.trim().toLowerCase()
  const withoutProtocol = trimmed.replace(/^https?:\/\//, '')
  const host = withoutProtocol.split('/')[0]?.replace(/\.+$/, '') ?? ''

  if (!/^[a-z0-9.-]+(?::[0-9]{1,5})?$/.test(host) || !host.includes('.')) {
    return ''
  }

  return host
}

function slugExists(slug: string, exceptId?: string) {
  const row = db
    .prepare('SELECT id FROM links WHERE slug = ? AND (? IS NULL OR id != ?)')
    .get(slug, exceptId ?? null, exceptId ?? null) as { id: string } | undefined

  return Boolean(row)
}

function uniqueSlug(input?: string, exceptId?: string) {
  const base = normalizeSlug(input)

  if (!slugExists(base, exceptId)) {
    return base
  }

  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}-${index}`
    if (!slugExists(candidate, exceptId)) {
      return candidate
    }
  }

  return `${base}-${shortId()}`
}

function getOrigin(request: FastifyRequest) {
  const configured = envValue('WAYPOINT_PUBLIC_URL', 'OPENQR_PUBLIC_URL')
  if (configured) {
    return configured.replace(/\/+$/, '')
  }

  const forwardedHost = headerValue(request.headers['x-forwarded-host'])
  const forwardedProto = headerValue(request.headers['x-forwarded-proto'])
  const hostHeader = forwardedHost ?? request.headers.host ?? `${host}:${port}`
  const protocol = forwardedProto ?? 'http'

  return `${protocol}://${hostHeader}`.replace(/\/+$/, '')
}

function getRequestHost(request: FastifyRequest) {
  return headerValue(request.headers['x-forwarded-host']) ?? request.headers.host ?? `${host}:${port}`
}

function isAppHost(request: FastifyRequest) {
  const requestHost = getRequestHost(request).toLowerCase()
  const configured = envValue('WAYPOINT_PUBLIC_URL', 'OPENQR_PUBLIC_URL')

  if (configured) {
    try {
      return requestHost === new URL(configured).host.toLowerCase()
    } catch {
      return false
    }
  }

  return [`${host}:${port}`, `127.0.0.1:${port}`, `localhost:${port}`].includes(requestHost)
}

function getDomainOrigin(hostname: string, requestOrigin: string) {
  const protocol =
    envValue('WAYPOINT_DOMAIN_PROTOCOL', 'OPENQR_DOMAIN_PROTOCOL') ??
    (requestOrigin.startsWith('https://') ? 'https' : 'http')
  return `${protocol}://${hostname}`
}

function headerValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

function shortUrlForRow(row: { slug: string; domainHostname?: string | null }, origin: string) {
  const brandedOrigin = row.domainHostname ? getDomainOrigin(row.domainHostname, origin) : null

  return brandedOrigin ? `${brandedOrigin}/${row.slug}` : `${origin}/r/${row.slug}`
}

function toSummary(row: LinkSummaryRow, origin: string) {
  return {
    id: row.id,
    domainId: row.domainId,
    domainHostname: row.domainHostname,
    domainLabel: row.domainLabel,
    slug: row.slug,
    title: row.title,
    destination: row.destination,
    description: row.description ?? '',
    active: row.active === 1,
    qrForeground: row.qrForeground,
    qrBackground: row.qrBackground,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    scans: Number(row.scans ?? 0),
    scans24: Number(row.scans24 ?? 0),
    shortUrl: shortUrlForRow(row, origin),
    fallbackUrl: `${origin}/r/${row.slug}`,
    qrSvgUrl: `/api/links/${row.id}/qr.svg`,
  }
}

function insertLink(input: z.infer<typeof csvImportRowSchema>) {
  const id = nanoid()
  const createdAt = nowIso()
  const slug = uniqueSlug(input.slug || input.title)
  const domainId = input.domainId === undefined ? (getPrimaryDomain()?.id ?? null) : input.domainId

  db.prepare(
    `INSERT INTO links
      (id, domainId, slug, title, destination, description, active, qrForeground, qrBackground, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    domainId,
    slug,
    input.title,
    input.destination,
    input.description ?? null,
    input.active === undefined || input.active ? 1 : 0,
    input.qrForeground ?? '#071318',
    input.qrBackground ?? '#ffffff',
    createdAt,
    createdAt,
  )

  return getLinkById(id) as LinkRow
}

function getLinkById(id: string) {
  return db.prepare('SELECT * FROM links WHERE id = ?').get(id) as LinkRow | undefined
}

function getLinkBySlug(slug: string) {
  return db.prepare('SELECT * FROM links WHERE slug = ?').get(slug) as LinkRow | undefined
}

function getLinkSummaryById(id: string, since24: string) {
  return db
    .prepare(
      `SELECT
        links.*,
        domains.hostname AS domainHostname,
        domains.label AS domainLabel,
        COUNT(events.id) AS scans,
        SUM(CASE WHEN events.occurredAt >= ? THEN 1 ELSE 0 END) AS scans24
      FROM links
      LEFT JOIN domains ON domains.id = links.domainId
      LEFT JOIN events ON events.linkId = links.id
      WHERE links.id = ?
      GROUP BY links.id`,
    )
    .get(since24, id) as LinkSummaryRow | undefined
}

function getDomainById(id: string | null | undefined) {
  if (!id) {
    return undefined
  }

  return db.prepare('SELECT * FROM domains WHERE id = ?').get(id) as DomainRow | undefined
}

function getPrimaryDomain() {
  return db.prepare('SELECT * FROM domains WHERE isPrimary = 1 ORDER BY updatedAt DESC LIMIT 1').get() as
    | DomainRow
    | undefined
}

function getDomainByHost(hostname: string) {
  return db.prepare('SELECT * FROM domains WHERE hostname = ?').get(hostname.toLowerCase()) as DomainRow | undefined
}

function getLinkForRedirect(slug: string, request: FastifyRequest) {
  const requestHost = getRequestHost(request).toLowerCase()
  const domain = getDomainByHost(requestHost)

  if (domain) {
    return db
      .prepare('SELECT * FROM links WHERE slug = ? AND domainId = ?')
      .get(slug, domain.id) as LinkRow | undefined
  }

  return getLinkBySlug(slug)
}

function ensureDomainAvailable(domainId: string | null | undefined) {
  if (!domainId) {
    return true
  }

  return Boolean(getDomainById(domainId))
}

function toDomain(row: DomainRow) {
  return {
    id: row.id,
    hostname: row.hostname,
    label: row.label,
    status: row.status,
    isPrimary: row.isPrimary === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function setPrimaryDomain(id: string) {
  db.prepare('UPDATE domains SET isPrimary = 0').run()
  db.prepare('UPDATE domains SET isPrimary = 1, updatedAt = ? WHERE id = ?').run(nowIso(), id)
}

function classifyDevice(userAgent: string) {
  if (/ipad|tablet/i.test(userAgent)) {
    return 'tablet'
  }

  if (/mobi|android|iphone/i.test(userAgent)) {
    return 'mobile'
  }

  return 'desktop'
}

function classifyBrowser(userAgent: string) {
  if (/edg/i.test(userAgent)) {
    return 'edge'
  }

  if (/chrome|crios/i.test(userAgent)) {
    return 'chrome'
  }

  if (/firefox|fxios/i.test(userAgent)) {
    return 'firefox'
  }

  if (/safari/i.test(userAgent)) {
    return 'safari'
  }

  return 'unknown'
}

function recordEvent(request: FastifyRequest, linkId: string) {
  const userAgent = headerValue(request.headers['user-agent']) ?? ''
  const referrer = headerValue(request.headers.referer) ?? null

  db.prepare(
    `INSERT INTO events (id, linkId, occurredAt, referrer, userAgent, device, browser)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(nanoid(), linkId, nowIso(), referrer, userAgent, classifyDevice(userAgent), classifyBrowser(userAgent))
}

function csvEscape(value: unknown) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function parseBoolean(value: unknown) {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) {
    return undefined
  }

  if (['1', 'true', 'yes', 'y', 'live', 'active'].includes(text)) {
    return true
  }

  if (['0', 'false', 'no', 'n', 'paused', 'inactive'].includes(text)) {
    return false
  }

  return undefined
}

function rowValue(row: Record<string, unknown>, ...keys: string[]) {
  const entries = new Map(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value]))

  for (const key of keys) {
    const value = entries.get(key.toLowerCase())
    if (value !== undefined && String(value).trim() !== '') {
      return String(value).trim()
    }
  }

  return undefined
}

function normalizeImportRow(row: Record<string, unknown>) {
  const destination = rowValue(row, 'destination', 'destination_url', 'url', 'target', 'target_url')
  const title = rowValue(row, 'title', 'name', 'label') ?? rowValue(row, 'slug') ?? destination
  const rawHostname = rowValue(row, 'domain', 'hostname', 'custom_domain')
  const hostname = rawHostname ? normalizeHostname(rawHostname) : ''
  const domain = hostname ? getDomainByHost(hostname) : undefined

  return {
    title,
    destination,
    slug: rowValue(row, 'slug', 'short_code', 'shortcode', 'path'),
    domainId: rawHostname ? (domain?.id ?? '__unknown_domain__') : undefined,
    description: rowValue(row, 'description', 'note', 'notes'),
    active: parseBoolean(rowValue(row, 'active', 'status')),
    qrForeground: rowValue(row, 'qrForeground', 'qr_foreground', 'foreground'),
    qrBackground: rowValue(row, 'qrBackground', 'qr_background', 'background'),
  }
}

function csvRowsFromLinks(rows: Array<LinkRow & { scans?: number; domainHostname?: string | null }>, origin: string) {
  const header = ['slug', 'title', 'destination', 'domain', 'shortUrl', 'active', 'scans', 'createdAt', 'updatedAt']
  const body = rows.map((row) =>
    [
      row.slug,
      row.title,
      row.destination,
      row.domainHostname ?? '',
      shortUrlForRow(row, origin),
      row.active === 1 ? 'true' : 'false',
      row.scans ?? '',
      row.createdAt,
      row.updatedAt,
    ]
      .map(csvEscape)
      .join(','),
  )

  return [header.join(','), ...body].join('\n')
}

function safeArchiveName(input: string) {
  return (
    normalizeSlug(input)
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || shortId()
  )
}

function getExportRows() {
  return db
    .prepare(
      `SELECT
        links.*,
        domains.hostname AS domainHostname,
        domains.label AS domainLabel,
        COUNT(events.id) AS scans
       FROM links
       LEFT JOIN domains ON domains.id = links.domainId
       LEFT JOIN events ON events.linkId = links.id
       GROUP BY links.id
       ORDER BY links.createdAt DESC`,
    )
    .all() as Array<LinkRow & { scans: number; domainHostname: string | null; domainLabel: string | null }>
}

function hasUsers() {
  const row = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }
  return Number(row.count) > 0
}

function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return {
    passwordHash: scryptSync(password, salt, 64).toString('hex'),
    passwordSalt: salt,
  }
}

function verifyPassword(password: string, user: UserRow) {
  const attempted = Buffer.from(hashPassword(password, user.passwordSalt).passwordHash, 'hex')
  const actual = Buffer.from(user.passwordHash, 'hex')

  return attempted.length === actual.length && timingSafeEqual(attempted, actual)
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function parseCookies(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header.join(';') : header
  const cookies = new Map<string, string>()

  if (!value) {
    return cookies
  }

  for (const pair of value.split(';')) {
    const separator = pair.indexOf('=')
    if (separator === -1) {
      continue
    }

    const key = pair.slice(0, separator).trim()
    const rawValue = pair.slice(separator + 1).trim()
    if (key) {
      cookies.set(key, decodeURIComponent(rawValue))
    }
  }

  return cookies
}

function getSessionToken(request: FastifyRequest) {
  const cookies = parseCookies(request.headers.cookie)
  return cookies.get(sessionCookieName) ?? cookies.get(legacySessionCookieName)
}

function getSessionUser(request: FastifyRequest) {
  const token = getSessionToken(request)
  if (!token) {
    return undefined
  }

  return db
    .prepare(
      `SELECT sessions.id AS sessionId, users.id AS userId, users.email, sessions.expiresAt
       FROM sessions
       JOIN users ON users.id = sessions.userId
       WHERE sessions.tokenHash = ? AND sessions.expiresAt > ?`,
    )
    .get(tokenHash(token), nowIso()) as SessionUserRow | undefined
}

function isCookieSecure(request: FastifyRequest) {
  const publicUrl = envValue('WAYPOINT_PUBLIC_URL', 'OPENQR_PUBLIC_URL') ?? ''
  const forwardedProto = headerValue(request.headers['x-forwarded-proto'])

  return (
    envValue('WAYPOINT_COOKIE_SECURE', 'OPENQR_COOKIE_SECURE') === '1' ||
    publicUrl.startsWith('https://') ||
    forwardedProto === 'https'
  )
}

function setSessionCookie(reply: FastifyReply, request: FastifyRequest, token: string, expiresAt: string) {
  const secure = isCookieSecure(request) ? '; Secure' : ''
  reply.header(
    'set-cookie',
    `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(
      expiresAt,
    ).toUTCString()}${secure}`,
  )
}

function clearSessionCookie(reply: FastifyReply) {
  const expiredAt = 'Thu, 01 Jan 1970 00:00:00 GMT'
  reply.header('set-cookie', [
    `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Expires=${expiredAt}`,
    `${legacySessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Expires=${expiredAt}`,
  ])
}

function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const createdAt = nowIso()
  const expiresAt = new Date(Date.now() + sessionDurationMs).toISOString()

  db.prepare(
    `INSERT INTO sessions (id, userId, tokenHash, createdAt, expiresAt)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(nanoid(), userId, tokenHash(token), createdAt, expiresAt)

  return { token, expiresAt }
}

function deleteCurrentSession(request: FastifyRequest) {
  const token = getSessionToken(request)
  if (token) {
    db.prepare('DELETE FROM sessions WHERE tokenHash = ?').run(tokenHash(token))
  }
}

const publicApiPaths = new Set(['/api/health', '/api/auth/me', '/api/auth/setup', '/api/auth/login', '/api/auth/logout'])

app.addHook('preHandler', async (request, reply) => {
  const path = request.url.split('?')[0]

  if (!path.startsWith('/api/') || publicApiPaths.has(path)) {
    return
  }

  if (!getSessionUser(request)) {
    return reply.code(401).send({ error: 'Authentication required' })
  }
})

app.get('/api/health', async () => ({
  ok: true,
  databasePath,
  setupRequired: !hasUsers(),
  generatedAt: nowIso(),
}))

app.get('/api/auth/me', async (request) => {
  const user = getSessionUser(request)

  return {
    authenticated: Boolean(user),
    setupRequired: !hasUsers(),
    user: user
      ? {
          id: user.userId,
          email: user.email,
        }
      : null,
  }
})

app.post('/api/auth/setup', async (request, reply) => {
  if (hasUsers()) {
    return reply.code(409).send({ error: 'Workspace is already set up' })
  }

  const parsed = setupSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid setup' })
  }

  const createdAt = nowIso()
  const userId = nanoid()
  const password = hashPassword(parsed.data.password)

  db.prepare(
    `INSERT INTO users (id, email, passwordHash, passwordSalt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(userId, parsed.data.email.toLowerCase(), password.passwordHash, password.passwordSalt, createdAt, createdAt)

  const session = createSession(userId)
  setSessionCookie(reply, request, session.token, session.expiresAt)

  return reply.code(201).send({
    authenticated: true,
    setupRequired: false,
    user: {
      id: userId,
      email: parsed.data.email.toLowerCase(),
    },
  })
})

app.post('/api/auth/login', async (request, reply) => {
  if (!hasUsers()) {
    return reply.code(409).send({ error: 'Setup required' })
  }

  const parsed = loginSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid login' })
  }

  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(parsed.data.email.toLowerCase()) as UserRow | undefined

  if (!user || !verifyPassword(parsed.data.password, user)) {
    return reply.code(401).send({ error: 'Email or password is incorrect' })
  }

  const session = createSession(user.id)
  setSessionCookie(reply, request, session.token, session.expiresAt)

  return {
    authenticated: true,
    setupRequired: false,
    user: {
      id: user.id,
      email: user.email,
    },
  }
})

app.post('/api/auth/logout', async (request, reply) => {
  deleteCurrentSession(request)
  clearSessionCookie(reply)

  return {
    authenticated: false,
    setupRequired: !hasUsers(),
    user: null,
  }
})

app.get('/api/domains', async () => {
  const rows = db
    .prepare('SELECT * FROM domains ORDER BY isPrimary DESC, updatedAt DESC')
    .all() as DomainRow[]

  return rows.map(toDomain)
})

app.post('/api/domains', async (request, reply) => {
  const parsed = domainSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid domain' })
  }

  const hostname = normalizeHostname(parsed.data.hostname)
  if (!hostname) {
    return reply.code(400).send({ error: 'Enter a valid hostname, such as go.example.com' })
  }

  const createdAt = nowIso()
  const id = nanoid()
  const hasPrimary = Boolean(getPrimaryDomain())
  const isPrimary = parsed.data.isPrimary || !hasPrimary

  try {
    db.prepare(
      `INSERT INTO domains (id, hostname, label, status, isPrimary, createdAt, updatedAt)
       VALUES (?, ?, ?, 'active', ?, ?, ?)`,
    ).run(id, hostname, parsed.data.label || hostname, isPrimary ? 1 : 0, createdAt, createdAt)
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      return reply.code(409).send({ error: 'Domain already exists' })
    }

    throw error
  }

  if (isPrimary) {
    setPrimaryDomain(id)
  }

  const row = getDomainById(id) as DomainRow
  return reply.code(201).send(toDomain(row))
})

app.patch<{ Params: { id: string } }>('/api/domains/:id', async (request, reply) => {
  const domain = getDomainById(request.params.id)
  if (!domain) {
    return reply.code(404).send({ error: 'Domain not found' })
  }

  const parsed = domainSchema.partial().safeParse(request.body)
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid domain update' })
  }

  const nextHostname =
    parsed.data.hostname !== undefined ? normalizeHostname(parsed.data.hostname) : domain.hostname
  if (!nextHostname) {
    return reply.code(400).send({ error: 'Enter a valid hostname, such as go.example.com' })
  }

  try {
    db.prepare(
      `UPDATE domains
       SET hostname = ?, label = ?, updatedAt = ?
       WHERE id = ?`,
    ).run(nextHostname, parsed.data.label || domain.label, nowIso(), domain.id)
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      return reply.code(409).send({ error: 'Domain already exists' })
    }

    throw error
  }

  if (parsed.data.isPrimary) {
    setPrimaryDomain(domain.id)
  }

  const row = getDomainById(domain.id) as DomainRow
  return toDomain(row)
})

app.delete<{ Params: { id: string } }>('/api/domains/:id', async (request, reply) => {
  const domain = getDomainById(request.params.id)
  if (!domain) {
    return reply.code(404).send({ error: 'Domain not found' })
  }

  db.prepare('UPDATE links SET domainId = NULL WHERE domainId = ?').run(domain.id)
  db.prepare('DELETE FROM domains WHERE id = ?').run(domain.id)

  const nextPrimary = getPrimaryDomain() ?? (db.prepare('SELECT * FROM domains ORDER BY updatedAt DESC LIMIT 1').get() as
    | DomainRow
    | undefined)
  if (nextPrimary && !getPrimaryDomain()) {
    setPrimaryDomain(nextPrimary.id)
  }

  return reply.code(204).send()
})

app.get('/api/links', async (request) => {
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const rows = db
    .prepare(
      `SELECT
        links.*,
        domains.hostname AS domainHostname,
        domains.label AS domainLabel,
        COUNT(events.id) AS scans,
        SUM(CASE WHEN events.occurredAt >= ? THEN 1 ELSE 0 END) AS scans24
      FROM links
      LEFT JOIN domains ON domains.id = links.domainId
      LEFT JOIN events ON events.linkId = links.id
      GROUP BY links.id
      ORDER BY links.updatedAt DESC`,
    )
    .all(since24) as LinkSummaryRow[]

  const origin = getOrigin(request)
  return rows.map((row) => toSummary(row, origin))
})

app.post('/api/links', async (request, reply) => {
  const parsed = createLinkSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid link' })
  }

  if (!ensureDomainAvailable(parsed.data.domainId)) {
    return reply.code(400).send({ error: 'Selected domain does not exist' })
  }

  const inserted = insertLink(parsed.data)
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const row = getLinkSummaryById(inserted.id, since24) as LinkSummaryRow
  return reply.code(201).send(toSummary(row, getOrigin(request)))
})

app.post('/api/import/links.csv', async (request, reply) => {
  const upload = await request.file()
  if (!upload) {
    return reply.code(400).send({ error: 'CSV file is required' })
  }

  const buffer = await upload.toBuffer()
  const rawRows = parseCsv(buffer, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, unknown>>

  if (rawRows.length > 500) {
    return reply.code(400).send({ error: 'Import limit is 500 rows per file' })
  }

  const created: ReturnType<typeof toSummary>[] = []
  const errors: Array<{ row: number; error: string }> = []
  const origin = getOrigin(request)

  for (const [index, rawRow] of rawRows.entries()) {
    const parsed = csvImportRowSchema.safeParse(normalizeImportRow(rawRow))
    if (!parsed.success) {
      errors.push({
        row: index + 2,
        error: parsed.error.issues[0]?.message ?? 'Invalid row',
      })
      continue
    }

    if (!ensureDomainAvailable(parsed.data.domainId)) {
      errors.push({
        row: index + 2,
        error: 'Selected domain does not exist',
      })
      continue
    }

    const inserted = insertLink(parsed.data)
    const row = getLinkSummaryById(inserted.id, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) as LinkSummaryRow
    created.push(toSummary(row, origin))
  }

  return reply.code(errors.length ? 207 : 201).send({
    created: created.length,
    skipped: errors.length,
    links: created.slice(0, 20),
    errors: errors.slice(0, 20),
  })
})

app.patch<{ Params: { id: string } }>('/api/links/:id', async (request, reply) => {
  const link = getLinkById(request.params.id)
  if (!link) {
    return reply.code(404).send({ error: 'Link not found' })
  }

  const parsed = updateLinkSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid update' })
  }

  const update = parsed.data
  if (!ensureDomainAvailable(update.domainId)) {
    return reply.code(400).send({ error: 'Selected domain does not exist' })
  }

  const updatedAt = nowIso()
  const nextSlug = update.slug !== undefined ? uniqueSlug(update.slug || link.title, link.id) : link.slug

  db.prepare(
    `UPDATE links
     SET domainId = ?,
         slug = ?,
         title = ?,
         destination = ?,
         description = ?,
         active = ?,
         qrForeground = ?,
         qrBackground = ?,
         updatedAt = ?
     WHERE id = ?`,
  ).run(
    update.domainId === undefined ? link.domainId : update.domainId,
    nextSlug,
    update.title ?? link.title,
    update.destination ?? link.destination,
    update.description ?? link.description,
    update.active === undefined ? link.active : update.active ? 1 : 0,
    update.qrForeground ?? link.qrForeground,
    update.qrBackground ?? link.qrBackground,
    updatedAt,
    link.id,
  )

  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const row = db
    .prepare(
      `SELECT
        links.*,
        domains.hostname AS domainHostname,
        domains.label AS domainLabel,
        COUNT(events.id) AS scans,
        SUM(CASE WHEN events.occurredAt >= ? THEN 1 ELSE 0 END) AS scans24
      FROM links
      LEFT JOIN domains ON domains.id = links.domainId
      LEFT JOIN events ON events.linkId = links.id
      WHERE links.id = ?
      GROUP BY links.id`,
    )
    .get(since24, link.id) as LinkSummaryRow

  return toSummary(row, getOrigin(request))
})

app.delete<{ Params: { id: string } }>('/api/links/:id', async (request, reply) => {
  const link = getLinkById(request.params.id)
  if (!link) {
    return reply.code(404).send({ error: 'Link not found' })
  }

  db.prepare('DELETE FROM links WHERE id = ?').run(link.id)
  return reply.code(204).send()
})

app.get<{ Params: { id: string } }>('/api/links/:id/events', async (request, reply) => {
  const link = getLinkById(request.params.id)
  if (!link) {
    return reply.code(404).send({ error: 'Link not found' })
  }

  const events = db
    .prepare(
      `SELECT id, linkId, occurredAt, referrer, userAgent, device, browser
       FROM events
       WHERE linkId = ?
       ORDER BY occurredAt DESC
       LIMIT 50`,
    )
    .all(link.id) as EventRow[]

  const daily = db
    .prepare(
      `SELECT substr(occurredAt, 1, 10) AS date, COUNT(*) AS scans
       FROM events
       WHERE linkId = ?
       GROUP BY date
       ORDER BY date ASC
       LIMIT 30`,
    )
    .all(link.id) as DailyRow[]

  return {
    events: events.map((event) => ({
      id: event.id,
      occurredAt: event.occurredAt,
      referrer: event.referrer ?? '',
      device: event.device,
      browser: event.browser,
    })),
    daily: daily.map((day) => ({
      date: day.date,
      scans: Number(day.scans),
    })),
  }
})

app.get<{ Params: { id: string }; Querystring: { download?: string } }>(
  '/api/links/:id/qr.svg',
  async (request, reply) => {
    const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const link = getLinkSummaryById(request.params.id, since24)
    if (!link) {
      return reply.code(404).send({ error: 'Link not found' })
    }

    const origin = getOrigin(request)
    const shortUrl = shortUrlForRow(link, origin)
    const svg = await QRCode.toString(shortUrl, {
      type: 'svg',
      color: {
        dark: link.qrForeground,
        light: link.qrBackground,
      },
      margin: 1,
      width: 512,
      errorCorrectionLevel: 'M',
    })

    if (request.query.download === '1') {
      reply.header('content-disposition', `attachment; filename="${link.slug}.svg"`)
    }

    return reply.type('image/svg+xml').send(svg)
  },
)

app.get('/api/export/links.csv', async (_request, reply) => {
  return reply
    .type('text/csv')
    .header('content-disposition', 'attachment; filename="waypoint-links.csv"')
    .send(csvRowsFromLinks(getExportRows(), getOrigin(_request)))
})

app.get('/api/export/qr.zip', async (request, reply) => {
  const rows = getExportRows()
  const origin = getOrigin(request)
  const zip = new ZipFile()

  zip.addBuffer(Buffer.from(csvRowsFromLinks(rows, origin)), 'waypoint-links.csv')

  for (const row of rows) {
    const svg = await QRCode.toString(shortUrlForRow(row, origin), {
      type: 'svg',
      color: {
        dark: row.qrForeground,
        light: row.qrBackground,
      },
      margin: 1,
      width: 512,
      errorCorrectionLevel: 'M',
    })

    zip.addBuffer(Buffer.from(svg), `qr/${safeArchiveName(row.slug)}.svg`)
  }

  zip.end()

  return reply
    .type('application/zip')
    .header('content-disposition', 'attachment; filename="waypoint-qr-codes.zip"')
    .send(zip.outputStream)
})

app.get<{ Params: { slug: string } }>('/r/:slug', async (request, reply) => {
  const link = getLinkBySlug(request.params.slug)

  if (!link || link.active !== 1) {
    return reply.code(404).type('text/plain').send('Waypoint link not found')
  }

  recordEvent(request, link.id)
  return reply.redirect(link.destination, 302)
})

app.get<{ Params: { slug: string } }>('/:slug', async (request, reply) => {
  const requestHost = getRequestHost(request).toLowerCase()
  const domain = getDomainByHost(requestHost)

  if (!domain) {
    if (isAppHost(request)) {
      return reply.callNotFound()
    }

    return reply.code(404).type('text/plain').send('Waypoint branded domain not found')
  }

  const link = getLinkForRedirect(request.params.slug, request)
  if (!link || link.active !== 1) {
    return reply.code(404).type('text/plain').send('Waypoint link not found')
  }

  recordEvent(request, link.id)
  return reply.redirect(link.destination, 302)
})

const distPath = join(process.cwd(), 'dist')
if (existsSync(distPath)) {
  await app.register(staticPlugin, {
    root: distPath,
  })

  app.get('/', async (_request, reply) => {
    return reply.sendFile('index.html', { maxAge: 0, immutable: false })
  })

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not found' })
    }

    return reply.sendFile('index.html')
  })
}

await app.listen({ port, host })
