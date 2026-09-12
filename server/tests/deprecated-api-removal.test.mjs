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

test('starts without deprecated Bio environment variables or services', async (t) => {
  const app = createTestApp()
  t.after(() => app.close())
  await app.ready()

  assert.equal(app.hasDecorator('redis'), false)
  assert.equal(app.hasDecorator('graphql'), false)
  assert.equal(app.hasRoute({ method: 'GET', url: '/api/ctd' }), true)
  assert.equal(app.hasRoute({ method: 'GET', url: '/api/sadcp' }), true)
})

test('returns 404 for retired GraphQL and Bio endpoints', async (t) => {
  const app = createTestApp()
  t.after(() => app.close())
  await app.ready()

  const retiredRequests = [
    { method: 'GET', url: '/gql' },
    { method: 'POST', url: '/gql', payload: { query: '{ __typename }' } },
    { method: 'GET', url: '/bio/occurrence/Calanus%20sinicus' },
    { method: 'GET', url: '/bio/taxonomy/Calanus%20sinicus' }
  ]

  for (const request of retiredRequests) {
    const response = await app.inject(request)
    assert.equal(response.statusCode, 404, `${request.method} ${request.url}`)
  }
})
