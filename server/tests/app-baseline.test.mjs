import assert from 'node:assert/strict'
import test from 'node:test'
import { Server as HttpsServer } from 'node:https'
import buildApp from '../src/app.mjs'

const testConfig = {
  SQLSERVER: '127.0.0.1', SQLPORT: 1433, SQLDBNAME: 'test',
  SQLUSER: 'test', SQLPASS: 'test', TABLE_CTD: 'ctd', TABLE_SADCP: 'sadcp',
  DOMAIN: 'localhost', BIOQRY_HOST: 'localhost', BIOQRY_BASE: 'bio',
  BIOQRY_GETBIO: 'occurrence', BIOQRY_GETSCI: 'taxonomy', BIOUSER: 'test',
  BIODB_HOST: 'localhost', BIODB: 'bio', FISHDB_HOST: 'localhost', FISHDB: 'fish'
}

const createTestApp = () => buildApp({
  fastifyOptions: { logger: false, trustProxy: false },
  envData: testConfig,
  appOptions: {
    enableDatabase: false,
    enableDeprecatedApis: false,
    enableStartupCacheProbe: false
  }
})

test('builds without TLS, a listening port, or SQL Server', async (t) => {
  const app = createTestApp()
  t.after(() => app.close())
  await app.ready()

  assert.equal(app.server.listening, false)
  assert.equal(app.server instanceof HttpsServer, false)
  assert.equal(app.hasDecorator('sqldb'), false)
})

test('keeps production paths and required coordinates', async (t) => {
  const app = createTestApp()
  t.after(() => app.close())
  await app.ready()

  assert.equal(app.hasRoute({ method: 'GET', url: '/api/ctd' }), true)
  assert.equal(app.hasRoute({ method: 'GET', url: '/api/sadcp' }), true)

  for (const path of ['/api/ctd', '/api/sadcp']) {
    const response = await app.inject({ method: 'GET', url: path })
    assert.equal(response.statusCode, 400)
  }
})

test('captures the pre-migration Swagger 2 contract', async (t) => {
  const app = createTestApp()
  t.after(() => app.close())
  await app.ready()

  const specification = app.swagger()
  assert.equal(specification.swagger, '2.0')
  assert.equal(specification.host, 'ecodata.odb.ntu.edu.tw')
  assert.ok(specification.paths['/api/ctd'])
  assert.ok(specification.paths['/api/sadcp'])
  assert.deepEqual(Object.keys(specification.paths).sort(), ['/api/ctd', '/api/sadcp'])
})
