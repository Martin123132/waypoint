import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  Check,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  Globe2,
  Link as LinkIcon,
  LockKeyhole,
  LogOut,
  PackageCheck,
  Plus,
  QrCode,
  RefreshCw,
  Route,
  Save,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import './App.css'
import {
  createLink,
  createDomain,
  deleteDomain,
  deleteLink,
  getAnalytics,
  getAuthStatus,
  importLinksCsv,
  listDomains,
  listLinks,
  login,
  logout,
  setupWorkspace,
  updateDomain,
  updateLink,
} from './api'
import { destinationWithUtm, emptyUtmForm, type UtmDraft } from './utm'
import type {
  AuthInput,
  AuthStatus,
  AuthUser,
  CreateLinkInput,
  DomainSummary,
  ImportResult,
  LinkAnalytics,
  LinkSummary,
} from './types'

type LinkDraft = {
  title: string
  destination: string
  slug: string
  domainId: string | null
  description: string
  active: boolean
  trackScans: boolean
  qrForeground: string
  qrBackground: string
}

type LinkFilter = 'all' | 'live' | 'paused' | 'branded' | 'fallback'

const emptyCreateForm: CreateLinkInput = {
  title: '',
  destination: '',
  slug: '',
  domainId: undefined,
  description: '',
  trackScans: true,
  qrForeground: '#071318',
  qrBackground: '#ffffff',
}

function toDraft(link: LinkSummary): LinkDraft {
  return {
    title: link.title,
    destination: link.destination,
    slug: link.slug,
    domainId: link.domainId,
    description: link.description,
    active: link.active,
    trackScans: link.trackScans,
    qrForeground: link.qrForeground,
    qrBackground: link.qrBackground,
  }
}

const emptyDomainForm = {
  hostname: '',
  label: '',
  isPrimary: true,
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function previewSlug(input?: string) {
  return (
    (input ?? '')
      .toLowerCase()
      .trim()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'auto-generated'
  )
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: ReactNode
}) {
  return (
    <section className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </section>
  )
}

function AccessScreen({
  mode,
  onComplete,
}: {
  mode: 'setup' | 'login'
  onComplete: (status: AuthStatus) => void
}) {
  const [form, setForm] = useState<AuthInput>({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isSetup = mode === 'setup'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const status = isSetup ? await setupWorkspace(form) : await login(form)
      onComplete(status)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not continue')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="access-shell">
      <section className="access-card">
        <div className="access-brand">
          <span className="brand-mark">
            <QrCode size={25} />
          </span>
          <span>
            <strong>Waypoint</strong>
            <small>{isSetup ? 'First run' : 'Admin access'}</small>
          </span>
        </div>

        <div className="access-copy">
          <LockKeyhole size={28} />
          <h1>{isSetup ? 'Secure this workspace' : 'Welcome back'}</h1>
          <p>
            {isSetup
              ? 'Create the admin account before link management opens.'
              : 'Sign in to manage destinations, QR codes, and analytics.'}
          </p>
        </div>

        <div className="mission-rail" aria-label="Launch path">
          <span>
            <ShieldCheck size={16} />
            Secure
          </span>
          <span>
            <QrCode size={16} />
            Create
          </span>
          <span>
            <Route size={16} />
            Share
          </span>
          <span>
            <BarChart3 size={16} />
            Learn
          </span>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <form className="access-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="admin@example.com"
              required
              type="email"
            />
          </label>
          <label>
            Password
            <input
              autoComplete={isSetup ? 'new-password' : 'current-password'}
              minLength={8}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="At least 8 characters"
              required
              type="password"
            />
          </label>
          <button className="primary-button" disabled={busy}>
            <ShieldCheck size={17} />
            {busy ? 'Working' : isSetup ? 'Create admin' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default function App() {
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function checkAuth() {
      try {
        setAuth(await getAuthStatus())
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not reach Waypoint')
      }
    }

    void checkAuth()
  }, [])

  async function handleLogout() {
    setAuth(await logout())
  }

  if (!auth) {
    return (
      <main className="access-shell">
        <section className="access-card compact-access">
          <div className="access-brand">
            <span className="brand-mark">
              <QrCode size={25} />
            </span>
            <span>
              <strong>Waypoint</strong>
              <small>Starting workspace</small>
            </span>
          </div>
          {error ? <div className="error-banner">{error}</div> : <div className="empty-state">Loading workspace.</div>}
        </section>
      </main>
    )
  }

  if (!auth.authenticated) {
    return <AccessScreen mode={auth.setupRequired ? 'setup' : 'login'} onComplete={setAuth} />
  }

  return <Dashboard user={auth.user} onLogout={() => void handleLogout()} />
}

function Dashboard({ user, onLogout }: { user: AuthUser | null; onLogout: () => void }) {
  const [links, setLinks] = useState<LinkSummary[]>([])
  const [domains, setDomains] = useState<DomainSummary[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [activePanel, setActivePanel] = useState<'links' | 'domains' | 'analytics'>('links')
  const [linkSearch, setLinkSearch] = useState('')
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('all')
  const [createForm, setCreateForm] = useState<CreateLinkInput>(emptyCreateForm)
  const [utmForm, setUtmForm] = useState<UtmDraft>(emptyUtmForm)
  const [domainForm, setDomainForm] = useState(emptyDomainForm)
  const [draft, setDraft] = useState<LinkDraft | null>(null)
  const [draftUtmForm, setDraftUtmForm] = useState<UtmDraft>(emptyUtmForm)
  const [analytics, setAnalytics] = useState<LinkAnalytics | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [copyFallback, setCopyFallback] = useState<{ linkId: string; url: string } | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState('')
  const [showStarterTip, setShowStarterTip] = useState(() => {
    try {
      return !sessionStorage.getItem('waypoint_starter_tip_seen')
    } catch {
      return true
    }
  })
  const createTitleRef = useRef<HTMLInputElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const domainHostnameRef = useRef<HTMLInputElement | null>(null)

  const selected = useMemo(
    () => links.find((link) => link.id === selectedId) ?? links[0],
    [links, selectedId],
  )

  const totals = useMemo(
    () => ({
      scans: links.reduce((sum, link) => sum + link.scans, 0),
      active: links.filter((link) => link.active).length,
      scans24: links.reduce((sum, link) => sum + link.scans24, 0),
    }),
    [links],
  )

  const filteredLinks = useMemo(() => {
    const query = linkSearch.trim().toLowerCase()

    return links.filter((link) => {
      const matchesFilter =
        linkFilter === 'all' ||
        (linkFilter === 'live' && link.active) ||
        (linkFilter === 'paused' && !link.active) ||
        (linkFilter === 'branded' && Boolean(link.domainHostname)) ||
        (linkFilter === 'fallback' && !link.domainHostname)

      if (!matchesFilter) {
        return false
      }

      if (!query) {
        return true
      }

      return [link.title, link.slug, link.destination, link.description, link.domainHostname ?? '', link.domainLabel ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [linkFilter, linkSearch, links])

  const linkFilters: Array<{ key: LinkFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'live', label: 'Live' },
    { key: 'paused', label: 'Paused' },
    { key: 'branded', label: 'Branded' },
    { key: 'fallback', label: 'Fallback' },
  ]

  const maxDailyScans = useMemo(() => {
    return Math.max(1, ...(analytics?.daily.map((day) => day.scans) ?? [0]))
  }, [analytics])

  const primaryDomain = useMemo(() => domains.find((domain) => domain.isPrimary), [domains])
  const hasBrandedLink = useMemo(() => links.some((link) => Boolean(link.domainHostname)), [links])
  const guideSteps = useMemo(
    () => [
      {
        key: 'build',
        label: '1. Build',
        detail: links.length > 0 ? `${links.length} ready` : 'Create code',
        href: '#create',
        icon: <Compass size={18} />,
        complete: links.length > 0,
      },
      {
        key: 'point',
        label: '2. Point',
        detail: selected ? 'Destination set' : 'Pick target',
        href: '#links',
        icon: <Route size={18} />,
        complete: Boolean(selected),
      },
      {
        key: 'brand',
        label: '3. Brand',
        detail: hasBrandedLink ? 'Link branded' : primaryDomain ? primaryDomain.hostname : 'Choose domain',
        href: '#domains',
        icon: <Globe2 size={18} />,
        complete: hasBrandedLink,
      },
      {
        key: 'learn',
        label: '4. Learn',
        detail: totals.scans > 0 ? `${totals.scans} scans` : 'Read scans',
        href: '#analytics',
        icon: <BarChart3 size={18} />,
        complete: totals.scans > 0,
      },
    ],
    [hasBrandedLink, links.length, primaryDomain, selected, totals.scans],
  )
  const currentStep = useMemo(() => guideSteps.find((step) => !step.complete) ?? guideSteps[guideSteps.length - 1], [guideSteps])
  const currentStepIndex = useMemo(() => {
    const index = guideSteps.findIndex((step) => step.key === currentStep.key)
    return index === -1 ? guideSteps.length - 1 : index
  }, [currentStep.key, guideSteps])
  const completedStepCount = useMemo(() => guideSteps.filter((step) => step.complete).length, [guideSteps])
  const launchProgress = Math.round((completedStepCount / guideSteps.length) * 100)
  const createPreviewSlug = useMemo(() => previewSlug(createForm.slug || createForm.title), [createForm.slug, createForm.title])
  const createDestinationReady = useMemo(() => isHttpUrl(createForm.destination), [createForm.destination])
  const createUtmReady = useMemo(() => Object.values(utmForm).some((value) => value.trim()), [utmForm])
  const createDomainPreview = useMemo(() => {
    if (createForm.domainId === null) {
      return null
    }

    if (createForm.domainId) {
      return domains.find((domain) => domain.id === createForm.domainId)?.hostname ?? null
    }

    return primaryDomain?.hostname ?? null
  }, [createForm.domainId, domains, primaryDomain])
  const createShortUrlPreview = createDomainPreview
    ? `http://${createDomainPreview}/${createPreviewSlug}`
    : `${window.location.origin}/r/${createPreviewSlug}`
  const draftDirty = useMemo(() => {
    if (!selected || !draft) {
      return false
    }

    return (
      draft.title !== selected.title ||
      draft.destination !== selected.destination ||
      draft.slug !== selected.slug ||
      draft.domainId !== selected.domainId ||
      draft.description !== selected.description ||
      draft.active !== selected.active ||
      draft.trackScans !== selected.trackScans ||
      draft.qrForeground !== selected.qrForeground ||
      draft.qrBackground !== selected.qrBackground
    )
  }, [draft, selected])
  const draftDestinationReady = useMemo(() => (draft ? isHttpUrl(draft.destination) : false), [draft])
  const draftUtmReady = useMemo(() => Object.values(draftUtmForm).some((value) => value.trim()), [draftUtmForm])
  const nextMove = useMemo(() => {
    if (links.length === 0) {
      return {
        title: 'Build first code',
        detail: 'Create one redirect, then the QR and fallback path appear here.',
        reason: 'Start anywhere later; this gets the board alive fastest.',
        href: '#create',
        action: 'Create code',
      }
    }

    if (domains.length === 0) {
      return {
        title: 'Add a brand path',
        detail: 'Register a domain once, then new links can inherit it automatically.',
        reason: 'A branded path turns the code from a utility into something people trust.',
        href: '#domains',
        action: 'Add domain',
      }
    }

    if (selected && !selected.domainHostname) {
      return {
        title: 'Apply brand to link',
        detail: `Use ${primaryDomain?.hostname ?? 'the primary domain'} for this code.`,
        reason: 'This keeps the public URL clean while the fallback stays ready.',
        href: '#links',
        action: 'Use primary',
        intent: 'apply-primary-domain',
      }
    }

    if (totals.scans === 0) {
      return {
        title: 'Share and watch',
        detail: selected ? selected.shortUrl : 'Export the QR pack and share the first code.',
        reason: 'Copy the live path now; scans will turn the last step on.',
        href: '/api/export/qr.zip',
        action: selected ? 'Copy link' : 'QR pack',
        intent: selected ? 'copy-selected-link' : undefined,
      }
    }

    return {
      title: 'Tune the winners',
      detail: 'Review recent scans and keep destinations fresh.',
      reason: 'The loop is running; optimize the links people actually use.',
      href: '#analytics',
      action: 'View scans',
    }
  }, [domains.length, links.length, primaryDomain, selected, totals.scans])
  const activeCopyFallback = copyFallback?.linkId === selected?.id ? copyFallback : null
  const canShareSelected = Boolean(selected)
  const hasActiveFilters = Boolean(linkSearch.trim()) || linkFilter !== 'all'

  function selectedDomainIdForCreate() {
    if (createForm.domainId === null) {
      return 'none'
    }

    return createForm.domainId ?? 'primary'
  }

  function domainIdFromSelect(value: string) {
    if (value === 'primary') {
      return undefined
    }

    if (value === 'none') {
      return null
    }

    return value
  }

  async function refreshLinks(preferredId?: string) {
    setLoading(true)
    setError('')

    try {
      const items = await listLinks()
      const nextSelected =
        (preferredId ? items.find((link) => link.id === preferredId) : undefined) ??
        items.find((link) => link.id === selectedId) ??
        items[0]

      setLinks(items)
      setSelectedId(nextSelected?.id ?? '')
      setDraft(nextSelected ? toDraft(nextSelected) : null)
      setDraftUtmForm(emptyUtmForm)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load links')
    } finally {
      setLoading(false)
    }
  }

  async function refreshDomains() {
    setDomains(await listDomains())
  }

  const setPanelFromHash = useCallback((hash: string) => {
    if (hash === '#domains') {
      setActivePanel('domains')
      return
    }

    if (hash === '#analytics') {
      setActivePanel('analytics')
      return
    }

    if (hash === '#links') {
      setActivePanel('links')
      return
    }

    if (hash === '#create') {
      setActivePanel('links')
      return
    }
  }, [])

  const jumpToPanel = useCallback((hash: string) => {
    setPanelFromHash(hash)
    if (hash) {
      window.location.hash = hash
    }
  }, [setPanelFromHash])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshLinks()
    void refreshDomains()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleHash = () => {
      setPanelFromHash(window.location.hash)
    }

    window.addEventListener('hashchange', handleHash)
    handleHash()

    return () => {
      window.removeEventListener('hashchange', handleHash)
    }
  }, [setPanelFromHash])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
        return
      }

      const activeElement = document.activeElement as HTMLElement | null
      const isTypingContext = activeElement?.tagName.toLowerCase() === 'textarea' || activeElement?.isContentEditable === true
      if (isTypingContext) {
        return
      }

      const key = event.key.toLowerCase()
      if (key === 'n') {
        event.preventDefault()
        jumpToPanel('#create')
        requestAnimationFrame(() => createTitleRef.current?.focus())
        return
      }

      if (key === '/') {
        event.preventDefault()
        jumpToPanel('#links')
        requestAnimationFrame(() => searchInputRef.current?.focus())
        return
      }

      if (key === 'd') {
        event.preventDefault()
        jumpToPanel('#domains')
        requestAnimationFrame(() => domainHostnameRef.current?.focus())
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => {
      window.removeEventListener('keydown', handleShortcut)
    }
  }, [jumpToPanel])

  useEffect(() => {
    let active = true

    async function loadAnalytics() {
      if (!selected?.id || !selected.trackScans) {
        setAnalytics(null)
        return
      }

      try {
        const data = await getAnalytics(selected.id)
        if (active) {
          setAnalytics(data)
        }
      } catch {
        if (active) {
          setAnalytics(null)
        }
      }
    }

    void loadAnalytics()
    return () => {
      active = false
    }
  }, [selected?.id, selected?.trackScans])

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 1800)
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('create')
    setError('')

    try {
      const created = await createLink({
        ...createForm,
        slug: createForm.slug?.trim() || undefined,
        description: createForm.description?.trim() || undefined,
        trackScans: createForm.trackScans,
      })
      setCreateForm(emptyCreateForm)
      setUtmForm(emptyUtmForm)
      await refreshLinks(created.id)
      flash('Link created')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create link')
    } finally {
      setBusy('')
    }
  }

  function handleApplyCreateUtm() {
    if (!createDestinationReady) {
      setError('Add a valid destination URL before applying campaign tags')
      return
    }

    setCreateForm({
      ...createForm,
      destination: destinationWithUtm(createForm.destination, utmForm),
    })
    setError('')
    flash('Campaign tags applied')
  }

  function handleApplyDraftUtm() {
    if (!draft || !draftDestinationReady) {
      setError('Add a valid destination URL before applying campaign tags')
      return
    }

    setDraft({
      ...draft,
      destination: destinationWithUtm(draft.destination, draftUtmForm),
    })
    setError('')
    flash('Campaign tags applied')
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!importFile) {
      setError('Choose a CSV file first')
      return
    }

    setBusy('import')
    setError('')
    setImportResult(null)

    try {
      const result = await importLinksCsv(importFile)
      setImportResult(result)
      setImportFile(null)
      await refreshLinks(result.links[0]?.id)
      flash(`Imported ${result.created} links`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not import CSV')
    } finally {
      setBusy('')
    }
  }

  async function handleCreateDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('domain')
    setError('')

    try {
      await createDomain({
        hostname: domainForm.hostname,
        label: domainForm.label.trim() || undefined,
        isPrimary: domainForm.isPrimary,
      })
      setDomainForm(emptyDomainForm)
      await refreshDomains()
      await refreshLinks(selected?.id)
      flash('Domain added')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add domain')
    } finally {
      setBusy('')
    }
  }

  async function handleMakePrimary(domainId: string) {
    setBusy(`primary-${domainId}`)
    setError('')

    try {
      await updateDomain(domainId, { isPrimary: true })
      await refreshDomains()
      await refreshLinks(selected?.id)
      flash('Primary domain set')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update domain')
    } finally {
      setBusy('')
    }
  }

  async function handleDeleteDomain(domain: DomainSummary) {
    if (!window.confirm(`Remove ${domain.hostname}? Existing links will fall back to /r/slug.`)) {
      return
    }

    setBusy(`delete-domain-${domain.id}`)
    setError('')

    try {
      await deleteDomain(domain.id)
      await refreshDomains()
      await refreshLinks(selected?.id)
      flash('Domain removed')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove domain')
    } finally {
      setBusy('')
    }
  }

  async function handleSave() {
    if (!selected || !draft) {
      return
    }

    setBusy('save')
    setError('')

    try {
      const updated = await updateLink(selected.id, {
        title: draft.title,
        destination: draft.destination,
        slug: draft.slug,
        domainId: draft.domainId,
        description: draft.description,
        active: draft.active,
        trackScans: draft.trackScans,
        qrForeground: draft.qrForeground,
        qrBackground: draft.qrBackground,
      })
      await refreshLinks(updated.id)
      flash('Changes saved')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save changes')
    } finally {
      setBusy('')
    }
  }

  async function handleApplyPrimaryDomain() {
    if (!selected || !primaryDomain) {
      return
    }

    setBusy('apply-domain')
    setError('')

    try {
      const updated = await updateLink(selected.id, { domainId: primaryDomain.id })
      await refreshLinks(updated.id)
      flash('Brand path applied')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not apply primary domain')
    } finally {
      setBusy('')
    }
  }

  async function handleDelete() {
    if (!selected) {
      return
    }

    if (deleteConfirmId !== selected.id) {
      setDeleteConfirmId(selected.id)
      return
    }

    setBusy('delete')
    setError('')

    try {
      await deleteLink(selected.id)
      setDeleteConfirmId('')
      await refreshLinks()
      flash('Link deleted')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete link')
    } finally {
      setBusy('')
    }
  }

  async function copyShortUrl() {
    if (!selected) {
      return
    }

    setBusy('copy-link')
    setError('')

    try {
      await copyText(selected.shortUrl)
      setCopyFallback(null)
      flash('Short link copied')
    } catch {
      setCopyFallback({ linkId: selected.id, url: selected.shortUrl })
      setError('Copy was blocked. Select the link below.')
    } finally {
      setBusy('')
    }
  }

  async function copyText(value: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()

    try {
      if (!document.execCommand('copy')) {
        throw new Error('Copy command failed')
      }
    } finally {
      textarea.remove()
    }
  }

  function dismissStarterTip() {
    setShowStarterTip(false)
    try {
      sessionStorage.setItem('waypoint_starter_tip_seen', '1')
    } catch {
      // Optional storage; still safe to continue if unavailable.
    }
  }

  function jumpToCreate() {
    jumpToPanel('#create')
    requestAnimationFrame(() => createTitleRef.current?.focus())
  }

  function jumpToDomains() {
    jumpToPanel('#domains')
    requestAnimationFrame(() => domainHostnameRef.current?.focus())
  }

  function jumpToSearch() {
    jumpToPanel('#links')
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }

  function resetLinkView() {
    setLinkSearch('')
    setLinkFilter('all')
    jumpToPanel('#links')
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }

  async function shareFromMission() {
    if (!selected) {
      jumpToPanel('#links')
      return
    }

    await copyShortUrl()
  }

  return (
    <div className="app-shell">
      <aside className="side-rail">
        <a className="brand" href="/" aria-label="Waypoint home">
          <span className="brand-mark">
            <QrCode size={25} />
          </span>
          <span>
            <strong>Waypoint</strong>
            <small>Route control</small>
          </span>
        </a>

        <nav className="rail-nav" aria-label="Primary">
          <a
            aria-current={activePanel === 'links' ? 'page' : undefined}
            className={activePanel === 'links' ? 'active' : ''}
            href="#links"
            onClick={() => jumpToPanel('#links')}
          >
            <LinkIcon size={18} />
            Links
          </a>
          <a
            aria-current={activePanel === 'domains' ? 'page' : undefined}
            className={activePanel === 'domains' ? 'active' : ''}
            href="#domains"
            onClick={() => jumpToPanel('#domains')}
          >
            <Globe2 size={18} />
            Domains
          </a>
          <a
            aria-current={activePanel === 'analytics' ? 'page' : undefined}
            className={activePanel === 'analytics' ? 'active' : ''}
            href="#analytics"
            onClick={() => jumpToPanel('#analytics')}
          >
            <BarChart3 size={18} />
            Analytics
          </a>
        </nav>

          <div className="rail-footer">
            <span className="status-dot" />
            <span>
              <strong>{user?.email ?? 'Admin'}</strong>
              <small>{primaryDomain ? primaryDomain.hostname : 'Local SQLite'}</small>
            </span>
          </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>Waypoint links</h1>
            <p>{links.length} managed destinations</p>
          </div>
          <div className="topbar-actions">
            {notice ? (
              <span className="toast">
                <Check size={16} />
                {notice}
              </span>
            ) : null}
            <a className="secondary-button" href="/api/export/links.csv">
              <Download size={17} />
              Export
            </a>
            <a className="secondary-button" href="/api/export/qr.zip">
              <PackageCheck size={17} />
              QR pack
            </a>
            <button className="icon-button" onClick={() => void refreshLinks()} title="Refresh links">
              <RefreshCw size={18} />
            </button>
            <button className="icon-button" onClick={onLogout} title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        {showStarterTip ? (
          <section className="starter-tip" aria-label="Welcome tip">
            <p>
              Try <strong>N = New</strong>, <strong>/ = Search</strong>, <strong>D = Domains</strong>.
              Use these shortcuts to jump around quickly.
            </p>
            <button className="secondary-button" onClick={dismissStarterTip} type="button">
              Got it
            </button>
          </section>
        ) : null}

        <section className="mission-chips" aria-label="Mission actions">
          <button className="mission-chip" onClick={jumpToCreate} type="button">
            <Plus size={16} />
            <span>{links.length === 0 ? 'Create first code' : 'Create a code'}</span>
          </button>
          <button className="mission-chip" onClick={jumpToDomains} type="button">
            <Globe2 size={16} />
            <span>Add brand domain</span>
          </button>
          <button className="mission-chip" disabled={!canShareSelected} onClick={() => void shareFromMission()} type="button">
            <Copy size={16} />
            <span>Share link</span>
          </button>
        </section>

        <section className="action-dock" aria-label="Quick actions">
          <button className="dock-action" onClick={jumpToCreate} title="New code" type="button">
            <Plus size={17} />
            <span>New</span>
          </button>
          <button className="dock-action" onClick={jumpToSearch} title="Search links" type="button">
            <Search size={17} />
            <span>Search</span>
          </button>
          <button className="dock-action" onClick={jumpToDomains} title="Manage domains" type="button">
            <Globe2 size={17} />
            <span>Domains</span>
          </button>
          <a className="dock-action" href="/api/export/qr.zip" title="Download QR pack">
            <PackageCheck size={17} />
            <span>QR ZIP</span>
          </a>
        </section>

        <section className="guide-strip" aria-label="Launch path">
          {guideSteps.map((step) => (
            <a
              className={`guide-step ${step.complete ? 'complete' : ''} ${currentStep.key === step.key ? 'current' : ''}`}
              href={step.href}
              key={step.key}
            >
              {step.complete ? <Check size={18} /> : step.icon}
              <span>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </span>
            </a>
          ))}
        </section>

        <section
          className={`next-move ${activeCopyFallback ? 'copy-open' : ''}`}
          aria-label="Next move"
        >
          <div className="next-copy">
            <small>
              Step {currentStepIndex + 1} of {guideSteps.length} - {completedStepCount} complete
            </small>
            <strong>{nextMove.title}</strong>
            <span>{nextMove.detail}</span>
            <em>{nextMove.reason}</em>
            <em>Shortcut: N = New, / = Search, D = Domains</em>
            <div className="move-progress" aria-label={`Launch progress ${launchProgress}%`}>
              <span style={{ width: `${launchProgress}%` }} />
            </div>
          </div>
          {nextMove.intent === 'apply-primary-domain' ? (
            <button
              className="secondary-button"
              disabled={busy === 'apply-domain'}
              onClick={() => void handleApplyPrimaryDomain()}
            >
              <ArrowRight size={16} />
              {busy === 'apply-domain' ? 'Applying' : nextMove.action}
            </button>
          ) : nextMove.intent === 'copy-selected-link' ? (
            <button className="secondary-button" disabled={busy === 'copy-link'} onClick={() => void copyShortUrl()}>
              <Copy size={16} />
              {busy === 'copy-link' ? 'Copying' : nextMove.action}
            </button>
          ) : (
            <a className="secondary-button" href={nextMove.href}>
              <ArrowRight size={16} />
              {nextMove.action}
            </a>
          )}
          {activeCopyFallback ? (
            <label className="copy-fallback">
              Copy manually
              <input
                readOnly
                value={activeCopyFallback.url}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
          ) : null}
        </section>

        <section className="metrics" aria-label="Link metrics">
          <MetricCard label="Total scans" value={totals.scans} icon={<QrCode size={20} />} />
          <MetricCard label="Scans today" value={totals.scans24} icon={<BarChart3 size={20} />} />
          <MetricCard label="Active links" value={totals.active} icon={<LinkIcon size={20} />} />
        </section>

        <section className="content-grid" id="links">
          <div className="left-stack">
            <section className="panel create-panel" id="create">
              <div className="panel-heading">
                <div>
                  <h2>New dynamic code</h2>
                  <p>Destination, slug, and QR colors</p>
                </div>
                <Plus size={20} />
              </div>

              <form className="form-grid" onSubmit={handleCreate}>
                <label>
                  Title
                  <input
                    ref={createTitleRef}
                    value={createForm.title}
                    onChange={(event) => setCreateForm({ ...createForm, title: event.target.value })}
                    placeholder="Launch page"
                    required
                  />
                </label>
                <label>
                  Destination URL
                  <input
                    value={createForm.destination}
                    onChange={(event) => setCreateForm({ ...createForm, destination: event.target.value })}
                    placeholder="https://example.com"
                    type="url"
                    required
                  />
                  <small className={createDestinationReady ? 'field-hint ready' : 'field-hint'}>
                    {createDestinationReady ? 'Destination ready' : 'Paste a full https:// destination'}
                  </small>
                </label>
                <div className="utm-builder" aria-label="UTM builder">
                  <div className="utm-fields">
                    <label>
                      UTM source
                      <input
                        value={utmForm.source}
                        onChange={(event) => setUtmForm({ ...utmForm, source: event.target.value })}
                        placeholder="newsletter"
                      />
                    </label>
                    <label>
                      UTM medium
                      <input
                        value={utmForm.medium}
                        onChange={(event) => setUtmForm({ ...utmForm, medium: event.target.value })}
                        placeholder="qr"
                      />
                    </label>
                    <label>
                      UTM campaign
                      <input
                        value={utmForm.campaign}
                        onChange={(event) => setUtmForm({ ...utmForm, campaign: event.target.value })}
                        placeholder="launch"
                      />
                    </label>
                  </div>
                  <button
                    className="secondary-button"
                    disabled={!createDestinationReady || !createUtmReady}
                    onClick={handleApplyCreateUtm}
                    type="button"
                  >
                    Apply UTM
                  </button>
                </div>
                <label>
                  Slug
                  <input
                    value={createForm.slug}
                    onChange={(event) => setCreateForm({ ...createForm, slug: event.target.value })}
                    placeholder="launch"
                  />
                  <small className="field-hint">Preview slug: {createPreviewSlug}</small>
                </label>
                <label>
                  Domain
                  <select
                    value={selectedDomainIdForCreate()}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, domainId: domainIdFromSelect(event.target.value) })
                    }
                  >
                    <option value="primary">
                      {primaryDomain ? `Primary: ${primaryDomain.hostname}` : 'Primary domain when added'}
                    </option>
                    <option value="none">App fallback /r/slug</option>
                    {domains.map((domain) => (
                      <option key={domain.id} value={domain.id}>
                        {domain.hostname}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Note
                  <input
                    value={createForm.description}
                    onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })}
                    placeholder="Campaign or owner"
                  />
                </label>
                <label className="switch-label">
                  <input
                    checked={createForm.trackScans}
                    onChange={(event) => setCreateForm({ ...createForm, trackScans: event.target.checked })}
                    type="checkbox"
                  />
                  Track scans
                </label>
                <div className="swatch-row">
                  <label>
                    Foreground
                    <input
                      type="color"
                      value={createForm.qrForeground}
                      onChange={(event) => setCreateForm({ ...createForm, qrForeground: event.target.value })}
                    />
                  </label>
                  <label>
                    Background
                    <input
                      type="color"
                      value={createForm.qrBackground}
                      onChange={(event) => setCreateForm({ ...createForm, qrBackground: event.target.value })}
                    />
                  </label>
                </div>
                <div className="create-preview" aria-label="Create preview">
                  <span>Live preview</span>
                  <strong>{createShortUrlPreview}</strong>
                  <small>{createDestinationReady ? 'Ready to generate QR and fallback path' : 'Add a destination to unlock the first code'}</small>
                </div>
                <button className="primary-button" disabled={busy === 'create'}>
                  <Plus size={17} />
                  {busy === 'create' ? 'Creating' : 'Create code'}
                </button>
              </form>
            </section>

            <section className="panel bulk-panel" id="bulk">
              <div className="panel-heading">
                <div>
                  <h2>Bulk run</h2>
                  <p>Import CSV, then export the QR pack</p>
                </div>
                <FileUp size={20} />
              </div>

              <form className="bulk-form" onSubmit={handleImport}>
                <label>
                  CSV file
                  <input
                    accept=".csv,text/csv"
                    onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                    type="file"
                  />
                </label>
                <div className="bulk-actions">
                  <button className="primary-button" disabled={busy === 'import'}>
                    <FileUp size={17} />
                    {busy === 'import' ? 'Importing' : 'Import CSV'}
                  </button>
                  <a className="secondary-button" href="/api/export/qr.zip">
                    <PackageCheck size={17} />
                    QR ZIP
                  </a>
                </div>
              </form>

              <div className="csv-help">
                <strong>CSV columns</strong>
                <span>title, destination, slug, domain, description, active, trackScans</span>
              </div>

              {importResult ? (
                <div className="import-report">
                  <span>{importResult.created} created</span>
                  <span>{importResult.skipped} skipped</span>
                  {importResult.errors.length ? (
                    <small>
                      Row {importResult.errors[0].row}: {importResult.errors[0].error}
                    </small>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="panel domain-panel" id="domains">
              <div className="panel-heading">
                <div>
                  <h2>Domains</h2>
                  <p>Brand the path, keep the fallback</p>
                </div>
                <Globe2 size={20} />
              </div>

              <form className="domain-form" onSubmit={handleCreateDomain}>
                <label>
                  Hostname
                  <input
                    ref={domainHostnameRef}
                    value={domainForm.hostname}
                    onChange={(event) => setDomainForm({ ...domainForm, hostname: event.target.value })}
                    placeholder="go.example.com"
                    required
                  />
                </label>
                <label>
                  Label
                  <input
                    value={domainForm.label}
                    onChange={(event) => setDomainForm({ ...domainForm, label: event.target.value })}
                    placeholder="Campaign domain"
                  />
                </label>
                <label className="switch-label">
                  <input
                    checked={domainForm.isPrimary}
                    onChange={(event) => setDomainForm({ ...domainForm, isPrimary: event.target.checked })}
                    type="checkbox"
                  />
                  Primary for new links
                </label>
                <button className="primary-button" disabled={busy === 'domain'}>
                  <Globe2 size={17} />
                  {busy === 'domain' ? 'Adding' : 'Add domain'}
                </button>
              </form>

              <div className="domain-rows">
                {domains.length === 0 ? <div className="empty-state">No branded domains yet.</div> : null}
                {domains.map((domain) => (
                  <div className="domain-row" key={domain.id}>
                    <span>
                      <strong>{domain.hostname}</strong>
                      <small>{domain.isPrimary ? 'Primary domain' : domain.label}</small>
                    </span>
                    <div className="domain-actions">
                      {!domain.isPrimary ? (
                        <button
                          className="secondary-button"
                          disabled={busy === `primary-${domain.id}`}
                          onClick={() => void handleMakePrimary(domain.id)}
                        >
                          Primary
                        </button>
                      ) : null}
                      <button
                        className="danger-button"
                        disabled={busy === `delete-domain-${domain.id}`}
                        onClick={() => void handleDeleteDomain(domain)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel link-list">
              <div className="panel-heading">
                <div>
                  <h2>Links</h2>
                  <p>
                    {loading
                      ? 'Loading records'
                      : linkSearch || linkFilter !== 'all'
                        ? `${filteredLinks.length} of ${links.length} records`
                        : `${links.length} records`}
                  </p>
                </div>
              </div>

              <div className="link-tools" aria-label="Link list tools">
                <label className="search-field">
                  <Search size={16} />
                  <input
                    ref={searchInputRef}
                    aria-label="Search links"
                    value={linkSearch}
                    onChange={(event) => setLinkSearch(event.target.value)}
                    placeholder="Search title, slug, domain, URL"
                  />
                </label>
                <div className="filter-pills" aria-label="Filter links">
                  {linkFilters.map((filter) => (
                    <button
                      className={linkFilter === filter.key ? 'filter-pill active' : 'filter-pill'}
                      key={filter.key}
                      onClick={() => setLinkFilter(filter.key)}
                      type="button"
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="link-rows">
                {links.length === 0 && !loading ? (
                  <div className="empty-state guided-empty">
                    <QrCode size={34} />
                    <strong>No links yet.</strong>
                    <span>Create one route and Waypoint will generate the redirect, QR, and fallback path.</span>
                    <button className="secondary-button" onClick={jumpToCreate} type="button">
                      <Plus size={16} />
                      Create first code
                    </button>
                  </div>
                ) : null}
                {links.length > 0 && filteredLinks.length === 0 ? (
                  <div className="empty-state guided-empty">
                    <Search size={34} />
                    <strong>No links match this view.</strong>
                    <span>Clear the filters or create a fresh route from here.</span>
                    <div className="empty-actions">
                      <button className="secondary-button" onClick={resetLinkView} type="button">
                        <RefreshCw size={16} />
                        Reset view
                      </button>
                      <button className="secondary-button" onClick={jumpToCreate} type="button">
                        <Plus size={16} />
                        New code
                      </button>
                    </div>
                  </div>
                ) : null}
                {filteredLinks.map((link) => (
                  <button
                    key={link.id}
                    className={`link-row ${selected?.id === link.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedId(link.id)
                      setDraft(toDraft(link))
                      setDraftUtmForm(emptyUtmForm)
                      setDeleteConfirmId('')
                    }}
                  >
                    <span className="row-main">
                      <strong>{link.title}</strong>
                      <small>{link.domainHostname ? `${link.domainHostname}/${link.slug}` : `/r/${link.slug}`}</small>
                    </span>
                    <span className="row-meta">
                      <span className={link.active ? 'live-pill' : 'paused-pill'}>
                        {link.active ? 'Live' : 'Paused'}
                      </span>
                      <small>{link.scans} scans</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <section className="panel detail-panel">
            {selected && draft ? (
              <>
                <div className="detail-header">
                  <div>
                    <h2>{selected.title}</h2>
                    <p>Updated {formatDate(selected.updatedAt)}</p>
                  </div>
                  <div className="status-stack" aria-label="Link status">
                    <span className={selected.active ? 'live-pill' : 'paused-pill'}>
                      {selected.active ? 'Live' : 'Paused'}
                    </span>
                    <span className={selected.trackScans ? 'saved-pill' : 'paused-pill'}>
                      {selected.trackScans ? 'Tracking scans' : 'Scans off'}
                    </span>
                    <span className={draftDirty ? 'pending-pill' : 'saved-pill'}>
                      {draftDirty ? 'Unsaved edits' : 'Saved'}
                    </span>
                    <span className={draftDestinationReady ? 'saved-pill' : 'paused-pill'}>
                      {draftDestinationReady ? 'Destination ready' : 'Needs URL'}
                    </span>
                  </div>
                </div>

                <div className="detail-body">
                  <div className="qr-preview">
                    <div className="qr-frame">
                      <img src={`${selected.qrSvgUrl}?v=${selected.updatedAt}`} alt={`${selected.title} QR code`} />
                    </div>
                    <div className="share-card" aria-label="Share this code">
                      <span>Share kit</span>
                      <strong>{selected.shortUrl}</strong>
                      {selected.domainHostname ? <small>Fallback: {selected.fallbackUrl}</small> : <small>Fallback path ready</small>}
                      <div className="share-badges" aria-label="Share readiness">
                        <span>QR ready</span>
                        <span>{selected.active ? 'Redirect live' : 'Redirect paused'}</span>
                        <span>{selected.trackScans ? 'Tracking on' : 'Tracking off'}</span>
                      </div>
                      <div className="share-actions">
                        <button className="secondary-button" onClick={() => void copyShortUrl()}>
                          <Copy size={16} />
                          Copy link
                        </button>
                        <a className="secondary-button" href={selected.shortUrl} target="_blank" rel="noreferrer">
                          <ExternalLink size={16} />
                          Open
                        </a>
                        <a className="secondary-button" href={`${selected.qrSvgUrl}?download=1`}>
                          <Download size={16} />
                          SVG
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="edit-form">
                    <label>
                      Title
                      <input
                        value={draft.title}
                        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                      />
                    </label>
                    <label>
                      Destination URL
                      <input
                        value={draft.destination}
                        onChange={(event) => setDraft({ ...draft, destination: event.target.value })}
                        type="url"
                      />
                    </label>
                    <div className="utm-builder" aria-label="Edit UTM builder">
                      <div className="utm-fields">
                        <label>
                          Edit UTM source
                          <input
                            value={draftUtmForm.source}
                            onChange={(event) => setDraftUtmForm({ ...draftUtmForm, source: event.target.value })}
                            placeholder="newsletter"
                          />
                        </label>
                        <label>
                          Edit UTM medium
                          <input
                            value={draftUtmForm.medium}
                            onChange={(event) => setDraftUtmForm({ ...draftUtmForm, medium: event.target.value })}
                            placeholder="qr"
                          />
                        </label>
                        <label>
                          Edit UTM campaign
                          <input
                            value={draftUtmForm.campaign}
                            onChange={(event) => setDraftUtmForm({ ...draftUtmForm, campaign: event.target.value })}
                            placeholder="launch"
                          />
                        </label>
                      </div>
                      <button
                        className="secondary-button"
                        disabled={!draftDestinationReady || !draftUtmReady}
                        onClick={handleApplyDraftUtm}
                        type="button"
                      >
                        Apply UTM
                      </button>
                    </div>
                    <label>
                      Slug
                      <input
                        value={draft.slug}
                        onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
                      />
                    </label>
                    <label>
                      Domain
                      <select
                        value={draft.domainId ?? 'none'}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            domainId: event.target.value === 'none' ? null : event.target.value,
                          })
                        }
                      >
                        <option value="none">App fallback /r/slug</option>
                        {domains.map((domain) => (
                          <option key={domain.id} value={domain.id}>
                            {domain.isPrimary ? 'Primary - ' : ''}
                            {domain.hostname}
                          </option>
                        ))}
                      </select>
                    </label>
                    {primaryDomain && !selected.domainHostname ? (
                      <div className="assist-row">
                        <span>
                          <strong>Brand this code</strong>
                          <small>{primaryDomain.hostname}</small>
                        </span>
                        <button
                          className="secondary-button"
                          disabled={busy === 'apply-domain'}
                          onClick={() => void handleApplyPrimaryDomain()}
                        >
                          {busy === 'apply-domain' ? 'Applying' : 'Use primary'}
                        </button>
                      </div>
                    ) : null}
                    <label>
                      Note
                      <input
                        value={draft.description}
                        onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                      />
                    </label>

                    <div className="switch-row">
                      <label className="switch-label">
                        <input
                          checked={draft.active}
                          onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                          type="checkbox"
                        />
                        Active redirect
                      </label>
                      <label className="switch-label">
                        <input
                          checked={draft.trackScans}
                          onChange={(event) => setDraft({ ...draft, trackScans: event.target.checked })}
                          type="checkbox"
                        />
                        Track scans
                      </label>
                      <div className="url-stack">
                        <span>{selected.shortUrl}</span>
                        {selected.domainHostname ? <small>{selected.fallbackUrl}</small> : null}
                      </div>
                    </div>

                    <div className="swatch-row">
                      <label>
                        Foreground
                        <input
                          type="color"
                          value={draft.qrForeground}
                          onChange={(event) => setDraft({ ...draft, qrForeground: event.target.value })}
                        />
                      </label>
                      <label>
                        Background
                        <input
                          type="color"
                          value={draft.qrBackground}
                          onChange={(event) => setDraft({ ...draft, qrBackground: event.target.value })}
                        />
                      </label>
                    </div>

                    <div className="button-row">
                      <button className="primary-button" onClick={() => void handleSave()} disabled={busy === 'save' || !draftDirty}>
                        <Save size={17} />
                        {busy === 'save' ? 'Saving' : draftDirty ? 'Save changes' : 'Saved'}
                      </button>
                      <button
                        className={`danger-button ${deleteConfirmId === selected.id ? 'confirming' : ''}`}
                        onClick={() => void handleDelete()}
                        disabled={busy === 'delete'}
                      >
                        <Trash2 size={17} />
                        {busy === 'delete' ? 'Deleting' : deleteConfirmId === selected.id ? 'Confirm delete' : 'Delete'}
                      </button>
                    </div>
                    {deleteConfirmId === selected.id ? (
                      <p className="delete-warning">This removes the redirect, QR record, and scan history for this code.</p>
                    ) : null}
                  </div>
                </div>

                <section className="analytics-grid" id="analytics">
                  <div className="analytics-card">
                    <div className="panel-heading compact">
                      <div>
                        <h3>30-day scans</h3>
                        <p>{selected.trackScans ? `${analytics?.daily.length ?? 0} active days` : 'Tracking disabled'}</p>
                      </div>
                    </div>
                    <div className="bars" aria-label="30-day scan chart">
                      {(analytics?.daily.length ? analytics.daily : [{ date: 'No scans', scans: 0 }]).map((day) => (
                        <div className="bar-column" key={day.date}>
                          <div className="bar-track">
                            <span style={{ height: `${Math.max(6, (day.scans / maxDailyScans) * 100)}%` }} />
                          </div>
                          <small>{day.date === 'No scans' ? 'None' : formatDay(day.date)}</small>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="analytics-card">
                    <div className="panel-heading compact">
                      <div>
                        <h3>Recent scans</h3>
                        <p>{selected.trackScans ? `${analytics?.events.length ?? 0} captured` : 'Tracking disabled'}</p>
                      </div>
                    </div>
                    <div className="event-table">
                      {(analytics?.events.length ? analytics.events : []).map((event) => (
                        <div className="event-row" key={event.id}>
                          <span>{formatDate(event.occurredAt)}</span>
                          <span>{event.device}</span>
                          <span>{event.browser}</span>
                        </div>
                      ))}
                      {analytics?.events.length === 0 ? <div className="empty-state">No scans recorded.</div> : null}
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <div className="empty-detail">
                <QrCode size={48} />
                <h2>{links.length === 0 ? 'Ready for the first route' : 'Choose the next route'}</h2>
                <p>
                  {links.length === 0
                    ? 'Create a code to open the share kit, QR downloads, and analytics here.'
                    : hasActiveFilters
                      ? 'Reset the current view or create another code from here.'
                      : 'Select a saved link or start a new one from the actions above.'}
                </p>
                <div className="empty-actions">
                  <button className="primary-button" onClick={jumpToCreate} type="button">
                    <Plus size={17} />
                    {links.length === 0 ? 'Create first code' : 'New code'}
                  </button>
                  {hasActiveFilters ? (
                    <button className="secondary-button" onClick={resetLinkView} type="button">
                      <RefreshCw size={16} />
                      Reset view
                    </button>
                  ) : (
                    <button className="secondary-button" onClick={jumpToDomains} type="button">
                      <Globe2 size={16} />
                      Add domain
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  )
}
