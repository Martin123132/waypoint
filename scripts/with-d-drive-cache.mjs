import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { win32 } from 'node:path'

const commandArgs = process.argv.slice(2)
const isWindows = process.platform === 'win32'
const dCacheRoot = process.env.WAYPOINT_D_CACHE_ROOT ?? 'D:\\CodexCache'

function windowsPath(...parts) {
  return win32.join(...parts)
}

function buildEnv() {
  const inheritedEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key, value]) => key && !key.includes('=') && value !== undefined),
  )

  if (!isWindows) {
    return inheritedEnv
  }

  const tempRoot = windowsPath(dCacheRoot, 'temp')
  const npmRoot = windowsPath(dCacheRoot, 'npm')
  const playwrightRoot = windowsPath(dCacheRoot, 'playwright')
  const waypointRoot = windowsPath(dCacheRoot, 'waypoint')
  const waypointTestRoot = windowsPath(waypointRoot, 'tests')

  for (const path of [tempRoot, npmRoot, playwrightRoot, waypointRoot, waypointTestRoot]) {
    mkdirSync(path, { recursive: true })
  }

  return {
    ...inheritedEnv,
    TEMP: tempRoot,
    TMP: tempRoot,
    npm_config_cache: npmRoot,
    npm_config_userconfig: windowsPath(npmRoot, 'npmrc'),
    PLAYWRIGHT_BROWSERS_PATH: playwrightRoot,
    WAYPOINT_PLAYWRIGHT_BROWSERS_PATH: playwrightRoot,
    WAYPOINT_TEST_ROOT: waypointTestRoot,
    WAYPOINT_TEMP_ROOT: tempRoot,
  }
}

if (commandArgs.length === 0) {
  if (isWindows) {
    console.log(`Waypoint D-drive cache root: ${dCacheRoot}`)
    console.log('Run a command through this wrapper, for example:')
    console.log('  npm run verify:d-drive')
  } else {
    console.log('D-drive cache mode is only applied on Windows; command environment is unchanged here.')
  }
  process.exit(0)
}

const [rawCommand, ...rawArgs] = commandArgs

function quoteWindowsArg(value) {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) {
    return value
  }

  return `"${value.replace(/(["\\])/g, '\\$1')}"`
}

const child = isWindows
  ? spawn([rawCommand, ...rawArgs].map(quoteWindowsArg).join(' '), [], {
      env: buildEnv(),
      shell: true,
      stdio: 'inherit',
    })
  : spawn(rawCommand, rawArgs, {
      env: buildEnv(),
      stdio: 'inherit',
    })

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
