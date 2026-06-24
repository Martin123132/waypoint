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
const testRoot = process.env.WAYPOINT_TEST_ROOT ?? process.env.OPENQR_TEST_ROOT ?? join(cacheRoot, 'waypoint', 'tests')
const tempRoot = process.env.WAYPOINT_TEMP_ROOT ?? process.env.OPENQR_TEMP_ROOT ?? join(cacheRoot, 'tmp')
const profileRoot =
  process.env.WAYPOINT_PLAYWRIGHT_PROFILE_ROOT ??
  process.env.OPENQR_PLAYWRIGHT_PROFILE_ROOT ??
  join(cacheRoot, 'playwright-profiles')
const screenshotRoot =
  process.env.WAYPOINT_SCREENSHOT_ROOT ??
  process.env.OPENQR_SCREENSHOT_ROOT ??
  join(cacheRoot, 'waypoint', 'screenshots')

mkdirSync(testRoot, { recursive: true })
mkdirSync(tempRoot, { recursive: true })
mkdirSync(profileRoot, { recursive: true })
mkdirSync(screenshotRoot, { recursive: true })

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
  const stamp = Date.now()
  const baseUrl = `http://127.0.0.1:${port}`
  const databasePath = join(testRoot, `guided-ui-${stamp}.sqlite`)
  const profilePath = join(profileRoot, `guided-ui-${stamp}`)
  const child = spawn(process.execPath, ['dist-server/index.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      LOG_LEVEL: 'silent',
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
  let browser

  try {
    await waitForHealth(port, child, getLogs)

    const setupResponse = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'qa@example.com', password: 'waypoint-password-123' }),
    })
    assert(setupResponse.ok, `Setup failed ${setupResponse.status}: ${await setupResponse.text()}`)

    const setCookie = setupResponse.headers.get('set-cookie')
    assert(setCookie, 'Setup did not return an auth cookie')
    const [name, ...valueParts] = setCookie.split(';')[0].split('=')

    browser = await chromium.launchPersistentContext(profilePath, {
      headless: true,
      viewport: { width: 1440, height: 960 },
    })
    await browser.addCookies([{ name, value: valueParts.join('='), domain: '127.0.0.1', path: '/' }])

    const page = await browser.newPage()
    const consoleErrors = []
    page.on('pageerror', (error) => consoleErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })

    const slug = `guided-${stamp.toString().slice(-6)}`
    const host = `brand.localhost:${port}`
    const expectedUrl = `http://${host}/${slug}`

    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.getByText('Waypoint links').waitFor({ timeout: 10000 })
    await page.getByText('Build first code').waitFor({ timeout: 10000 })
    await page.getByText('Step 1 of 4 - 0 complete').waitFor({ timeout: 10000 })
    await page.getByText('Start anywhere later; this gets the board alive fastest.').waitFor({ timeout: 10000 })
    await page.getByText('Shortcut: N = New, / = Search, D = Domains').waitFor({ timeout: 10000 })
    const starterTip = page.getByText(/Try\s+N\s*=\s*New,\s*\/\s*=\s*Search,\s*D\s*=\s*Domains/i)
    await starterTip.waitFor({ timeout: 10000 })
    const missionActions = page.getByLabel('Mission actions')
    const missionCreateButton = missionActions.getByRole('button', { name: 'Create first code' })
    const missionDomainButton = missionActions.getByRole('button', { name: 'Add brand domain' })
    const missionShareButton = missionActions.getByRole('button', { name: 'Share link' })
    const actionCenterButton = page.getByTitle('Open actions')
    const dockNewButton = page.getByRole('button', { name: 'New' })
    const dockSearchButton = page.getByRole('button', { name: 'Search' })
    const dockDomainButton = page.getByRole('button', { name: 'Domains' })
    await missionCreateButton.waitFor({ timeout: 10000 })
    await missionDomainButton.waitFor({ timeout: 10000 })
    await missionShareButton.waitFor({ timeout: 10000 })
    await actionCenterButton.waitFor({ timeout: 10000 })
    await dockNewButton.waitFor({ timeout: 10000 })
    await dockSearchButton.waitFor({ timeout: 10000 })
    await dockDomainButton.waitFor({ timeout: 10000 })
    await page.getByText('Ready for the first route').waitFor({ timeout: 10000 })
    await page.getByText('Create a code to open the share kit, QR downloads, and analytics here.').waitFor({ timeout: 10000 })
    assert(await missionShareButton.isDisabled(), 'Share mission chip should be disabled without a selected link')

    await actionCenterButton.click()
    const actionDialog = page.getByRole('dialog', { name: 'Action center' })
    await actionDialog.waitFor({ timeout: 10000 })
    await actionDialog.getByRole('button', { name: /New code/ }).waitFor({ timeout: 10000 })
    await actionDialog.getByRole('button', { name: /Search links/ }).waitFor({ timeout: 10000 })
    await actionDialog.getByRole('button', { name: /brand domain/i }).waitFor({ timeout: 10000 })
    const newCodeCommand = actionDialog.getByRole('button', { name: /New code/ })
    assert(
      (await newCodeCommand.getAttribute('class'))?.includes('recommended-command'),
      'Action center should recommend new code before links exist',
    )
    assert(
      await actionDialog.getByRole('button', { name: /Copy current link/ }).isDisabled(),
      'Action center copy command should be disabled without a selected link',
    )
    await actionDialog.getByRole('button', { name: /New code/ }).click()

    const createTitleFieldFromAction = page.getByRole('textbox', { name: 'Title' })
    await createTitleFieldFromAction.waitFor({ state: 'visible', timeout: 10000 })
    assert(
      await createTitleFieldFromAction.evaluate((node) => node === document.activeElement),
      'Action center new command did not focus the title field',
    )

    await page.keyboard.press('Control+K')
    await actionDialog.waitFor({ timeout: 10000 })
    await actionDialog.getByRole('button', { name: /Search links/ }).click()
    const searchFieldFromAction = page.getByRole('textbox', { name: 'Search links' })
    await searchFieldFromAction.waitFor({ state: 'visible', timeout: 10000 })
    assert(
      await searchFieldFromAction.evaluate((node) => node === document.activeElement),
      'Action center search command did not focus the search field',
    )

    await missionCreateButton.click()

    const createTitleFieldFromChip = page.getByRole('textbox', { name: 'Title' })
    await createTitleFieldFromChip.waitFor({ state: 'visible', timeout: 10000 })
    assert(
      await createTitleFieldFromChip.evaluate((node) => node === document.activeElement),
      'Create mission chip did not focus the title field',
    )

    await missionDomainButton.click()
    const missionDomainField = page.getByRole('textbox', { name: 'Hostname' })
    await missionDomainField.waitFor({ state: 'visible', timeout: 10000 })
    assert(
      await missionDomainField.evaluate((node) => node === document.activeElement),
      'Domain mission chip did not focus the hostname field',
    )

    await dockSearchButton.click()
    const dockSearchField = page.getByRole('textbox', { name: 'Search links' })
    await dockSearchField.waitFor({ state: 'visible', timeout: 10000 })
    assert(
      await dockSearchField.evaluate((node) => node === document.activeElement),
      'Search dock action did not focus the search field',
    )

    await page.getByRole('button', { name: 'Got it' }).click()
    assert(
      !(await starterTip.isVisible().catch(() => false)),
      'Starter tip should hide after acknowledgement',
    )
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByText('Waypoint links').waitFor({ timeout: 10000 })
    assert(!(await starterTip.isVisible().catch(() => false)), 'Starter tip should remain hidden in the same browser session')

    await page.keyboard.press('d')
    const domainHostnameField = page.getByRole('textbox', { name: 'Hostname' })
    await domainHostnameField.waitFor({ state: 'visible', timeout: 10000 })
    assert(
      await domainHostnameField.evaluate((node) => node === document.activeElement),
      'D shortcut did not focus the domain hostname field',
    )

    await page.keyboard.press('/')
    const searchField = page.getByRole('textbox', { name: 'Search links' })
    await searchField.waitFor({ state: 'visible', timeout: 10000 })
    assert(
      await searchField.evaluate((node) => node === document.activeElement),
      'Slash shortcut did not focus the search field',
    )

    await page.keyboard.press('n')
    const createTitleField = page.getByRole('textbox', { name: 'Title' })
    await createTitleField.waitFor({ state: 'visible', timeout: 10000 })
    await page.waitForTimeout(50)
    const activeHash = await page.evaluate(() => window.location.hash)
    assert(activeHash === '#create' || activeHash === '', 'N shortcut did not jump to create panel')

    const createPanel = page.locator('.create-panel')
    await createPanel.getByText('Paste a full https:// destination').waitFor({ timeout: 10000 })
    await createPanel.getByRole('textbox', { name: 'Title' }).fill('Guided Path')
    await createPanel.getByRole('textbox', { name: 'Destination URL' }).fill('https://example.com/guided')
    await createPanel.getByRole('textbox', { name: 'UTM source' }).fill('newsletter')
    await createPanel.getByRole('textbox', { name: 'UTM medium' }).fill('qr')
    await createPanel.getByRole('textbox', { name: 'UTM campaign' }).fill('summer launch')
    await createPanel.getByRole('button', { name: 'Apply UTM' }).click()
    const taggedDestination = 'https://example.com/guided?utm_source=newsletter&utm_medium=qr&utm_campaign=summer+launch'
    assert(
      (await createPanel.getByRole('textbox', { name: 'Destination URL' }).inputValue()) === taggedDestination,
      'UTM builder did not update the create destination URL',
    )
    await createPanel.getByRole('textbox', { name: 'Slug' }).fill(slug)
    await createPanel.getByText('Destination ready').waitFor({ timeout: 10000 })
    await createPanel.getByText(`Preview slug: ${slug}`).waitFor({ timeout: 10000 })
    await createPanel.getByText(`${baseUrl}/r/${slug}`).waitFor({ timeout: 10000 })
    await createPanel.getByText('Ready to generate QR and fallback path').waitFor({ timeout: 10000 })
    await createPanel.getByRole('button', { name: /Create code/ }).click()
    const detailPanel = page.locator('.detail-panel')
    const shareCard = detailPanel.locator('.share-card')
    await detailPanel.getByText('Share kit').waitFor({ timeout: 10000 })
    await shareCard.getByText(`${baseUrl}/r/${slug}`).waitFor({ timeout: 10000 })
    await shareCard.getByText('QR ready').waitFor({ timeout: 10000 })
    await shareCard.getByText('Redirect live').waitFor({ timeout: 10000 })
    await shareCard.getByText('Tracking on').waitFor({ timeout: 10000 })
    await detailPanel.getByText('Destination ready').waitFor({ timeout: 10000 })
    await actionCenterButton.click()
    await actionDialog.waitFor({ timeout: 10000 })
    const addBrandCommand = actionDialog.getByRole('button', { name: /Add brand domain/ })
    assert(
      (await addBrandCommand.getAttribute('class'))?.includes('recommended-command'),
      'Action center should recommend adding a brand domain after the first fallback link exists',
    )
    await page.keyboard.press('Escape')
    await actionDialog.waitFor({ state: 'hidden', timeout: 10000 })
    assert(!(await missionShareButton.isDisabled()), 'Share mission chip should enable when a link is selected')
    await missionShareButton.click()
    await page.waitForTimeout(500)
    const missionShareFallback = await page.locator('.copy-fallback input').isVisible().catch(() => false)
    const missionToast = await page.locator('.toast').textContent().catch(() => '')
    assert(
      missionShareFallback || missionToast.includes('Short link copied'),
      'Share mission chip should copy or expose manual fallback',
    )
    assert(
      (await detailPanel.getByRole('textbox', { name: 'Destination URL' }).inputValue()) === taggedDestination,
      'Created link did not preserve the tagged destination URL',
    )
    await detailPanel.getByRole('textbox', { name: 'Edit UTM source' }).fill('retargeting')
    await detailPanel.getByRole('button', { name: 'Apply UTM' }).click()
    const retaggedDestination = 'https://example.com/guided?utm_source=retargeting&utm_medium=qr&utm_campaign=summer+launch'
    assert(
      (await detailPanel.getByRole('textbox', { name: 'Destination URL' }).inputValue()) === retaggedDestination,
      'Edit UTM builder did not update the draft destination URL',
    )
    await detailPanel.getByRole('link', { name: 'SVG' }).waitFor({ timeout: 10000 })
    await detailPanel.getByRole('textbox', { name: 'Note' }).fill('QA note')
    await detailPanel.getByText('Unsaved edits').waitFor({ timeout: 10000 })
    await detailPanel.getByRole('button', { name: 'Save changes' }).click()
    await detailPanel.getByText('Saved').waitFor({ timeout: 10000 })
    await page.getByRole('textbox', { name: 'Search links' }).fill('retargeting')
    await page.getByText('1 of 1 records').waitFor({ timeout: 10000 })
    await page.locator('.link-row').getByText('Guided Path').waitFor({ timeout: 10000 })
    await page.getByRole('textbox', { name: 'Search links' }).fill('missing-link')
    await page.getByText('No links match this view.').waitFor({ timeout: 10000 })
    await page.getByRole('textbox', { name: 'Search links' }).fill('')
    await page.getByRole('button', { name: 'Fallback' }).click()
    await page.getByText('1 of 1 records').waitFor({ timeout: 10000 })
    await detailPanel.getByRole('button', { name: 'Delete' }).click()
    await detailPanel.getByRole('button', { name: 'Confirm delete' }).waitFor({ timeout: 10000 })
    await detailPanel
      .getByText('This removes the redirect, QR record, and scan history for this code.')
      .waitFor({ timeout: 10000 })
    await page.getByText('Add a brand path').waitFor({ timeout: 10000 })
    await page.getByText('Step 3 of 4 - 2 complete').waitFor({ timeout: 10000 })
    await page.getByText('A branded path turns the code from a utility into something people trust.').waitFor({ timeout: 10000 })

    const domainPanel = page.locator('.domain-panel')
    await domainPanel.getByRole('textbox', { name: 'Hostname' }).fill(host)
    await domainPanel.getByRole('textbox', { name: 'Label' }).fill('Brand path')
    await domainPanel.getByRole('button', { name: /Add domain/ }).click()
    await page.getByText('Apply brand to link').waitFor({ timeout: 10000 })

    await actionCenterButton.click()
    await actionDialog.waitFor({ timeout: 10000 })
    const applyBrandCommand = actionDialog.getByRole('button', { name: /Apply brand to current link/ })
    await applyBrandCommand.waitFor({ timeout: 10000 })
    assert(
      (await applyBrandCommand.getAttribute('class'))?.includes('recommended-command'),
      'Action center should recommend applying the primary brand to an unbranded link',
    )
    await applyBrandCommand.click()
    await page.getByText('Share and watch').waitFor({ timeout: 10000 })
    await page.getByText('Step 4 of 4 - 3 complete').waitFor({ timeout: 10000 })
    await page.getByText('Copy the live path now; scans will turn the last step on.').waitFor({ timeout: 10000 })
    await page.locator(`text=${host}/${slug}`).first().waitFor({ timeout: 10000 })
    await page.getByRole('button', { name: 'Branded' }).click()
    await page.getByText('1 of 1 records').waitFor({ timeout: 10000 })

    await actionCenterButton.click()
    await actionDialog.waitFor({ timeout: 10000 })
    const copyCurrentCommand = actionDialog.getByRole('button', { name: /Copy current link/ })
    await copyCurrentCommand.waitFor({ timeout: 10000 })
    assert(
      (await copyCurrentCommand.getAttribute('class'))?.includes('recommended-command'),
      'Action center should recommend copying a branded link before scans exist',
    )
    await page.keyboard.press('Escape')
    await actionDialog.waitFor({ state: 'hidden', timeout: 10000 })
    await page.locator('.next-move').getByRole('button', { name: 'Copy link' }).click()
    await page.waitForTimeout(500)

    const fallback = page.locator('.copy-fallback input')
    const fallbackVisible = await fallback.isVisible().catch(() => false)
    const fallbackValue = fallbackVisible ? await fallback.inputValue() : ''
    let clipboardValue = ''
    try {
      clipboardValue = await page.evaluate(() => navigator.clipboard.readText())
    } catch {
      // Headless browsers can block clipboard reads; the manual fallback is the product guarantee.
    }
    assert(
      clipboardValue === expectedUrl || fallbackValue === expectedUrl,
      `Copy action did not expose ${expectedUrl}. Clipboard=${clipboardValue || '<empty>'} fallback=${fallbackValue || '<empty>'}`,
    )

    await detailPanel.getByRole('button', { name: 'Confirm delete' }).click()
    await page.getByText('No links yet.').waitFor({ timeout: 10000 })
    await page.getByText('Ready for the first route').waitFor({ timeout: 10000 })
    await page.getByText('Build first code').waitFor({ timeout: 10000 })
    await page.getByText('Step 1 of 4 - 0 complete').waitFor({ timeout: 10000 })
    const remainingLinkRows = await page.locator('.link-row').count()
    assert(remainingLinkRows === 0, `Expected no link rows after delete, found ${remainingLinkRows}`)

    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    assert(!desktopOverflow, 'Desktop layout has horizontal overflow')

    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByText('Build first code').waitFor({ timeout: 10000 })
    await page.getByText('No links yet.').waitFor({ timeout: 10000 })
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    assert(!mobileOverflow, 'Mobile layout has horizontal overflow')

    assert(consoleErrors.length === 0, `Browser console errors:\n${consoleErrors.join('\n')}`)
    console.log(`guided-ui ok: ${expectedUrl}`)
  } catch (error) {
    if (browser) {
      const pages = browser.pages()
      const page = pages[pages.length - 1]
      if (page) {
        const screenshotPath = join(screenshotRoot, `guided-ui-failure-${Date.now()}.png`)
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined)
        console.error(`Failure screenshot: ${screenshotPath}`)
      }
    }

    throw error
  } finally {
    if (browser) {
      await browser.close()
    }

    child.kill('SIGTERM')
    await new Promise((resolve) => child.once('exit', resolve))
    await rm(profilePath, { recursive: true, force: true })
  }
}

await run()
