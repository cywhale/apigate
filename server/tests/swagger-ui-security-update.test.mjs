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

test('loads the patched Swagger UI major', async () => {
  const packageUrl = import.meta.resolve('@fastify/swagger-ui/package.json')
  const packageJson = JSON.parse(await readFile(new URL(packageUrl), 'utf8'))
  assert.equal(packageJson.version, '6.1.1')
})

test('serves the existing Swagger UI and specification routes', async (t) => {
  const app = createTestApp()
  t.after(() => app.close())
  await app.ready()

  const uiResponse = await app.inject({ method: 'GET', url: '/api/' })
  assert.equal(uiResponse.statusCode, 200)
  assert.match(uiResponse.headers['content-type'], /^text\/html/)

  const jsonResponse = await app.inject({ method: 'GET', url: '/api/json' })
  assert.equal(jsonResponse.statusCode, 200)
  assert.match(jsonResponse.headers['content-type'], /^application\/json/)
  assert.equal(jsonResponse.json().swagger, '2.0')
  assert.ok(jsonResponse.json().paths['/api/ctd'])
  assert.ok(jsonResponse.json().paths['/api/sadcp'])

  const yamlResponse = await app.inject({ method: 'GET', url: '/api/yaml' })
  assert.equal(yamlResponse.statusCode, 200)
  assert.match(yamlResponse.payload, /^swagger: ['"]?2\.0['"]?/m)

  const assetResponse = await app.inject({
    method: 'GET',
    url: '/api/static/swagger-ui.css'
  })
  assert.equal(assetResponse.statusCode, 200)
  assert.match(assetResponse.headers['content-type'], /^text\/css/)
})
