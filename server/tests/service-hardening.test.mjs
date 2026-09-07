import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import buildApp from '../src/app.mjs'

const testConfig = {
  SQLSERVER: '127.0.0.1',
  SQLPORT: 1433,
  SQLDBNAME: 'test',
  SQLUSER: 'test',
  SQLPASS: 'test',
  TABLE_CTD: 'ctd',
  TABLE_SADCP: 'sadcp',
  DOMAIN: 'localhost'
}

const createTestApp = () => buildApp({
  fastifyOptions: { logger: false, trustProxy: false },
  envData: testConfig,
  appOptions: {
    enableDatabase: false,
    enableStartupCacheProbe: false
  }
})

test('public API allows cross-origin requests without credentials', async (t) => {
  const app = createTestApp()
  t.after(() => app.close())
  await app.ready()

  const origin = 'https://consumer.example'
  const response = await app.inject({
    method: 'GET',
    url: '/api/ctd',
    headers: { origin }
  })

  assert.equal(response.statusCode, 400)
  assert.equal(response.headers['access-control-allow-origin'], origin)
  assert.equal(response.headers['access-control-allow-credentials'], undefined)
})

test('production script runs once without file watching', async () => {
  const packageJson = JSON.parse(await readFile(
    new URL('../package.json', import.meta.url),
    'utf8'
  ))

  assert.doesNotMatch(packageJson.scripts.prod, /--watch/)
  assert.equal(packageJson.dependencies.fs, undefined)
})

test('package registry uses HTTPS', async () => {
  const npmrc = await readFile(new URL('../.npmrc', import.meta.url), 'utf8')
  assert.equal(npmrc.trim(), 'registry=https://registry.npmjs.org/')
})
