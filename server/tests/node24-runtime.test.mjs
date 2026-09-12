import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

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

test('loads the pinned nvm runtime before starting PM2', async () => {
  const script = await readFile(new URL('pm2.sh', serverUrl), 'utf8')

  assert.match(script, /\. "\$NVM_DIR\/nvm\.sh"/)
  assert.match(script, /nvm use --silent "\$SCRIPT_DIR\/\.\.\/\.nvmrc"/)
  assert.match(script, /exec pm2/)
})
