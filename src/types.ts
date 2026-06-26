export type LinkSummary = {
  id: string
  domainId: string | null
  domainHostname: string | null
  domainLabel: string | null
  slug: string
  title: string
  destination: string
  description: string
  active: boolean
  trackScans: boolean
  qrForeground: string
  qrBackground: string
  createdAt: string
  updatedAt: string
  scans: number
  scans24: number
  shortUrl: string
  fallbackUrl: string
  qrSvgUrl: string
}

export type LinkEvent = {
  id: string
  occurredAt: string
  referrer: string
  device: string
  browser: string
}

export type DailyScan = {
  date: string
  scans: number
}

export type LinkAnalytics = {
  events: LinkEvent[]
  daily: DailyScan[]
}

export type CreateLinkInput = {
  title: string
  destination: string
  slug?: string
  domainId?: string | null
  description?: string
  trackScans?: boolean
  qrForeground?: string
  qrBackground?: string
}

export type UpdateLinkInput = Partial<CreateLinkInput> & {
  active?: boolean
}

export type AuthUser = {
  id: string
  email: string
}

export type AuthStatus = {
  authenticated: boolean
  setupRequired: boolean
  user: AuthUser | null
}

export type AuthInput = {
  email: string
  password: string
}

export type ImportError = {
  row: number
  error: string
}

export type ImportResult = {
  created: number
  skipped: number
  links: LinkSummary[]
  errors: ImportError[]
}

export type DomainSummary = {
  id: string
  hostname: string
  label: string
  status: string
  isPrimary: boolean
  createdAt: string
  updatedAt: string
}

export type DomainInput = {
  hostname: string
  label?: string
  isPrimary?: boolean
}

export type DemoSeedResult = {
  synthetic: true
  note: string
  domain: DomainSummary
  links: LinkSummary[]
  eventsSeeded: number
}
