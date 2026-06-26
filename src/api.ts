import type {
  AuthInput,
  AuthStatus,
  CreateLinkInput,
  DemoRemoveResult,
  DemoSeedResult,
  DomainInput,
  DomainSummary,
  ImportResult,
  LinkAnalytics,
  LinkSummary,
  UpdateLinkInput,
} from './types'

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
    ...init,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(payload.error ?? response.statusText)
  }

  return response.json() as Promise<T>
}

export function listLinks() {
  return requestJson<LinkSummary[]>('/api/links')
}

export function listDomains() {
  return requestJson<DomainSummary[]>('/api/domains')
}

export function createDomain(input: DomainInput) {
  return requestJson<DomainSummary>('/api/domains', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateDomain(id: string, input: Partial<DomainInput>) {
  return requestJson<DomainSummary>(`/api/domains/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function deleteDomain(id: string) {
  const response = await fetch(`/api/domains/${id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(payload.error ?? response.statusText)
  }
}

export function getAuthStatus() {
  return requestJson<AuthStatus>('/api/auth/me')
}

export function setupWorkspace(input: AuthInput) {
  return requestJson<AuthStatus>('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function login(input: AuthInput) {
  return requestJson<AuthStatus>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function logout() {
  return requestJson<AuthStatus>('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function createLink(input: CreateLinkInput) {
  return requestJson<LinkSummary>('/api/links', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function seedDemoWorkspace() {
  return requestJson<DemoSeedResult>('/api/demo/seed', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function removeDemoWorkspace() {
  const response = await fetch('/api/demo/seed', {
    method: 'DELETE',
    credentials: 'same-origin',
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(payload.error ?? response.statusText)
  }

  return response.json() as Promise<DemoRemoveResult>
}

export async function importLinksCsv(file: File) {
  const form = new FormData()
  form.append('file', file)

  const response = await fetch('/api/import/links.csv', {
    method: 'POST',
    body: form,
    credentials: 'same-origin',
  })

  if (!response.ok && response.status !== 207) {
    const payload = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(payload.error ?? response.statusText)
  }

  return response.json() as Promise<ImportResult>
}

export function updateLink(id: string, input: UpdateLinkInput) {
  return requestJson<LinkSummary>(`/api/links/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function deleteLink(id: string) {
  const response = await fetch(`/api/links/${id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(payload.error ?? response.statusText)
  }
}

export function getAnalytics(id: string) {
  return requestJson<LinkAnalytics>(`/api/links/${id}/events`)
}
