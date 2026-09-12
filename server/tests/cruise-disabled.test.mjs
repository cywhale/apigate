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

const createTestApp = (validatedQueries) => buildApp({
  fastifyOptions: { logger: false, trustProxy: false },
  configure: (app) => app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/api/ctd')) {
      validatedQueries.push({ ...request.query })
      return reply.code(204).send()
    }
  }),
  envData: testConfig,
  appOptions: {
    enableDatabase: false,
    enableStartupCacheProbe: false
  }
})

test('does not publish cruise in the CTD API contract', async (t) => {
  const app = createTestApp([])
  t.after(() => app.close())
  await app.ready()

  const specification = app.swagger()
  const parameterNames = specification.paths['/api/ctd'].get.parameters
    .map((parameter) => parameter.name)

  assert.equal(parameterNames.includes('cruise'), false)
})

test('discards external cruise input before the request handler', async (t) => {
  const validatedQueries = []
  const app = createTestApp(validatedQueries)
  t.after(() => app.close())
  await app.ready()

  const baseUrl = '/api/ctd?lon0=120&lat0=20&mode=monsoon'
  const withoutCruise = await app.inject({ method: 'GET', url: baseUrl })
  const withCruise = await app.inject({
    method: 'GET',
    url: `${baseUrl}&cruise=%22%3BDELETE%20FROM%20ctd%3B--`
  })

  assert.equal(withoutCruise.statusCode, 204)
  assert.equal(withCruise.statusCode, 204)
  assert.deepEqual(validatedQueries, [
    { lon0: 120, lat0: 20, mode: 'monsoon', append: 'temperature' },
    { lon0: 120, lat0: 20, mode: 'monsoon', append: 'temperature' }
  ])
})
