import assert from 'node:assert/strict'
import test from 'node:test'
import buildApp from '../src/app.mjs'

const testConfig = {
  SQLSERVER: '127.0.0.1', SQLPORT: 1433, SQLDBNAME: 'test',
  SQLUSER: 'test', SQLPASS: 'test', TABLE_CTD: 'ctd', TABLE_SADCP: 'sadcp',
  DOMAIN: 'localhost'
}

const createTestApp = () => buildApp({
  fastifyOptions: { logger: false, trustProxy: false },
  configure: app => app.addHook('preHandler', async (_request, reply) => reply.code(204).send()),
  envData: testConfig,
  appOptions: { enableDatabase: false, enableStartupCacheProbe: false }
})

const operation = (specification, path) => specification.paths[path].get

test('documents the accepted API date formats for both production endpoints', async t => {
  const app = createTestApp()
  t.after(() => app.close())
  await app.ready()

  for (const path of ['/api/ctd', '/api/sadcp']) {
    const parameters = operation(app.swagger(), path).parameters
    const byName = Object.fromEntries(parameters.map(parameter => [parameter.name, parameter]))
    for (const name of ['start', 'end']) {
      assert.equal(byName[name].schema.pattern, '^(?:[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{8})$')
    }
  }
})

test('accepts standard date forms and rejects ambiguous date formats before the handler', async t => {
  const app = createTestApp()
  t.after(() => app.close())
  await app.ready()

  for (const value of ['1992-05-01', '19920501']) {
    const response = await app.inject(`/api/sadcp?lon0=100&lat0=2&start=${value}&end=2023-01-01`)
    assert.equal(response.statusCode, 204, value)
  }

  for (const value of ['1992/05/01', '1992-5-1', '1992-05-01T00:00:00Z']) {
    const response = await app.inject(`/api/sadcp?lon0=100&lat0=2&start=${encodeURIComponent(value)}`)
    assert.equal(response.statusCode, 400, value)
  }
})
