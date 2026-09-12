import assert from 'node:assert/strict'
import test from 'node:test'
import buildApp from '../src/app.mjs'

const testConfig = {
  SQLSERVER: '127.0.0.1', SQLPORT: 1433, SQLDBNAME: 'test',
  SQLUSER: 'test', SQLPASS: 'test', TABLE_CTD: 'ctd', TABLE_SADCP: 'sadcp',
  DOMAIN: 'localhost'
}

const createTestApp = (handledRequests) => buildApp({
  fastifyOptions: { logger: false, trustProxy: false },
  configure: (app) => app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/api/ctd') || request.url.startsWith('/api/sadcp')) {
      handledRequests.push(request.url)
      return reply.code(204).send()
    }
  }),
  envData: testConfig,
  appOptions: { enableDatabase: false, enableStartupCacheProbe: false }
})

test('does not publish or accept any public raw-data mode', async (t) => {
  const handledRequests = []
  const app = createTestApp(handledRequests)
  t.after(() => app.close())
  await app.ready()

  const specification = app.swagger()
  for (const path of ['/api/ctd', '/api/sadcp']) {
    const mode = specification.paths[path].get.parameters
      .find((parameter) => parameter.name === 'mode').schema
    assert.equal(JSON.stringify(mode).includes('raw'), false)

    for (const rawMode of ['raw', 'raw0', 'raw1', 'rawx']) {
      const response = await app.inject(`${path}?lon0=120&lat0=20&mode=${rawMode}`)
      assert.equal(response.statusCode, 400, `${path} mode=${rawMode}`)
    }
  }

  assert.deepEqual(handledRequests, [])
})
