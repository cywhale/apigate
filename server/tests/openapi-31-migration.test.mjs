import assert from 'node:assert/strict'
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

test('publishes an OpenAPI 3.1 document without Swagger 2 fields', async (t) => {
  const app = createTestApp()
  t.after(() => app.close())
  await app.ready()

  const specification = app.swagger()
  assert.equal(specification.openapi, '3.1.0')
  assert.equal(specification.swagger, undefined)
  assert.equal(specification.host, undefined)
  assert.equal(specification.schemes, undefined)
  assert.equal(specification.consumes, undefined)
  assert.equal(specification.produces, undefined)
})

test('preserves APIverse server and path identity invariants', async (t) => {
  const app = createTestApp()
  t.after(() => app.close())
  await app.ready()

  const specification = app.swagger()
  assert.deepEqual(specification.servers, [
    { url: 'https://ecodata.odb.ntu.edu.tw' }
  ])
  assert.deepEqual(Object.keys(specification.paths).sort(), [
    '/api/ctd',
    '/api/sadcp'
  ])

  const serverUrl = specification.servers[0].url
  assert.equal(new URL('/api/ctd', serverUrl).href,
    'https://ecodata.odb.ntu.edu.tw/api/ctd')
  assert.equal(new URL('/api/sadcp', serverUrl).href,
    'https://ecodata.odb.ntu.edu.tw/api/sadcp')
})

test('keeps both production operations as tagged GET requests', async (t) => {
  const app = createTestApp()
  t.after(() => app.close())
  await app.ready()

  const { paths } = app.swagger()
  assert.deepEqual(paths['/api/ctd'].get.tags, ['CTD'])
  assert.deepEqual(paths['/api/sadcp'].get.tags, ['SADCP'])
  assert.deepEqual(Object.keys(paths['/api/ctd']), ['get'])
  assert.deepEqual(Object.keys(paths['/api/sadcp']), ['get'])
})
