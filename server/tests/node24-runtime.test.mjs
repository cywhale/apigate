import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createRequire } from 'node:module'

const rootUrl = new URL('../../', import.meta.url)
const serverUrl = new URL('../', import.meta.url)

test('runs the suite on the pinned Node 24 runtime', async () => {
  const pinnedVersion = (await readFile(new URL('.nvmrc', rootUrl), 'utf8')).trim()
  const packageJson = JSON.parse(await readFile(new URL('package.json', serverUrl), 'utf8'))

  assert.match(pinnedVersion, /^24\./)
  assert.equal(process.versions.node, pinnedVersion)
  assert.equal(packageJson.engines.node, '>=24 <25')
  assert.equal(packageJson.packageManager, 'pnpm@8.15.4')
})

test('routes the legacy launcher to the checked runtime maintenance workflow', async () => {
  const script = await readFile(new URL('pm2.sh', serverUrl), 'utf8')

  assert.match(script, /exec "\$SCRIPT_DIR\/scripts\/upgrade-apigate-runtime\.sh" "\$@"/)
  assert.doesNotMatch(script, /PORT=3023|exec pm2/)
})

test('production configuration selects the pinned interpreter and stable service boundary', () => {
  const require = createRequire(import.meta.url)
  const { apps } = require('../ops/ecosystem.config.cjs')
  assert.equal(apps.length, 1)
  assert.equal(apps[0].cwd, '/home/odbadmin/proj/apigate/server')
  assert.equal(apps[0].instances, 2)
  assert.equal(apps[0].exec_mode, 'cluster')
  assert.equal(apps[0].watch, false)
  assert.equal(apps[0].interpreter, process.execPath)
  assert.deepEqual(apps[0].env, { NODE_ENV: 'production', NODE_OPTIONS: '--max_old_space_size=8192', PORT: '3025', APIGATE_TLS: 'false' })
})
