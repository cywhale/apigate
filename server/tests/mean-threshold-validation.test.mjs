import assert from 'node:assert/strict'
import test from 'node:test'
import buildApp from '../src/app.mjs'

const testConfig = {
  SQLSERVER: '127.0.0.1', SQLPORT: 1433, SQLDBNAME: 'test',
  SQLUSER: 'test', SQLPASS: 'test', TABLE_CTD: 'ctd', TABLE_SADCP: 'sadcp',
  DOMAIN: 'localhost'
}

const createTestApp = (validatedQueries) => buildApp({
  fastifyOptions: { logger: false, trustProxy: false },
  configure: (app) => app.addHook('preHandler', async (request, reply) => {
    validatedQueries.push({ ...request.query })
    return reply.code(204).send()
  }),
  envData: testConfig,
  appOptions: { enableDatabase: false, enableStartupCacheProbe: false }
})

test('documents mean_threshold as a SQL Server int on both public endpoints', async (t) => {
  const app = createTestApp([])
  t.after(() => app.close())
  await app.ready()

  const specification = app.swagger()
  for (const path of ['/api/ctd', '/api/sadcp']) {
    const schema = specification.paths[path].get.parameters
      .find(({ name }) => name === 'mean_threshold').schema
    assert.equal(schema.type, 'integer')
    assert.equal(schema.minimum, -2147483648)
    assert.equal(schema.maximum, 2147483647)
  }
})

test('coerces valid mean_threshold values to numbers before the handler', async (t) => {
  const validatedQueries = []
  const app = createTestApp(validatedQueries)
  t.after(() => app.close())
  await app.ready()

  for (const path of ['/api/ctd', '/api/sadcp']) {
    const response = await app.inject(`${path}?lon0=120&lat0=20&mean_threshold=5`)
    assert.equal(response.statusCode, 204)
  }
  assert.deepEqual(validatedQueries.map(({ mean_threshold }) => mean_threshold), [5, 5])
})

test('rejects non-integers and SQL text before the handler', async (t) => {
  const validatedQueries = []
  const app = createTestApp(validatedQueries)
  t.after(() => app.close())
  await app.ready()

  const unsafeValues = ['1.5', '2147483648', '-2147483649', '0%3BWAITFOR%20DELAY%20%270%3A0%3A1%27--']
  for (const path of ['/api/ctd', '/api/sadcp']) {
    for (const value of unsafeValues) {
      const response = await app.inject(`${path}?lon0=120&lat0=20&mean_threshold=${value}`)
      assert.equal(response.statusCode, 400, `${path}: ${value}`)
    }
  }
  assert.deepEqual(validatedQueries, [])
})
