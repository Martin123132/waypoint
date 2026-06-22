import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))

const checkedFiles = [
  'README.md',
  'PROJECT_STATUS.md',
  'LOCAL_STORAGE_POLICY.md',
  '.gitignore',
  '.dockerignore',
  '.env.example',
  'package.json',
  'tests/domain-routing.test.mjs',
  'tests/guided-ui.test.mjs',
  'tests/public-readiness.test.mjs',
  'scripts/generate-release-review-outcome.mjs',
]

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function readProjectFile(relativePath) {
  return readFileSync(join(projectRoot, relativePath), 'utf8')
}

function assertIncludes(file, expected) {
  assert(readProjectFile(file).includes(expected), `${file} is missing: ${expected}`)
}

for (const file of checkedFiles) {
  const contents = readProjectFile(file)
  const windowsPaths = [...contents.matchAll(/(?:^|[^A-Za-z])([A-Za-z]:[\\/][^\s`'")]+)/g)].map((match) => match[1])
  for (const windowsPath of windowsPaths) {
    assert(windowsPath.startsWith('D:\\'), `${file} contains a non-D absolute Windows path: ${windowsPath}`)
  }
  assert(!contents.includes('C:/'), `${file} contains a C:/ path`)
  assert(!contents.includes('C:\\'), `${file} contains a C:\\ path`)
}

assertIncludes('README.md', "D:\\CodexCache\\npm")
assertIncludes('README.md', "D:\\CodexCache\\playwright")
assertIncludes('PROJECT_STATUS.md', 'Generated data and caches should stay on D:')
assertIncludes('LOCAL_STORAGE_POLICY.md', 'Do not commit absolute C drive paths.')
assertIncludes('LOCAL_STORAGE_POLICY.md', 'npm run test:storage')

assertIncludes('tests/domain-routing.test.mjs', "process.platform === 'win32' ? 'D:\\\\CodexCache'")
assertIncludes('tests/guided-ui.test.mjs', "process.platform === 'win32' ? 'D:\\\\CodexCache'")

for (const ignoredPath of ['node_modules', 'dist', 'dist-server', 'data', 'outputs', '*.sqlite', '.env']) {
  assertIncludes('.gitignore', ignoredPath)
  assertIncludes('.dockerignore', ignoredPath)
}

console.log('storage-policy ok')
