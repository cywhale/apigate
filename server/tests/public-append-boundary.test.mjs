import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
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

const rows = {
  ctd: {
    longitude: 120,
    latitude: 20,
    time_period: 0,
    depth: 10,
    temperature: 1,
    salinity: 2,
    density: 3,
    fluorescence: 4,
    transmission: 5,
    oxygen: 6,
    count: 7
  },
  sadcp: {
    longitude: 120,
    latitude: 20,
    time_period: 0,
    depth: 10,
    u: 1,
    v: 2,
    speed: 3,
    direction: 4,
    count: 7
  }
}

class FakeSqlStream extends EventEmitter {
  destroy () {}
}

const createTestApp = (queries) => buildApp({
  fastifyOptions: { logger: false, trustProxy: false },
  configure: app => app.decorate('sqldb', {
    raw: query => ({
      stream: () => {
        const stream = new FakeSqlStream()
        const procedure = query.includes('[sadcp') ? 'sadcp' : 'ctd'
        process.nextTick(() => {
          stream.emit('data', { ...rows[procedure] })
          stream.emit('end')
          stream.emit('finish')
        })
        queries.push(query)
        return stream
      }
    })
  }),
  envData: testConfig,
  appOptions: { enableDatabase: false, enableStartupCacheProbe: false }
})

test('filters unsupported and injection-like append values before SQL EXEC', async t => {
  for (const [path, input, expected] of [['/api/ctd', 'temperature', 'temperature'], ['/api/sadcp', 'u', 'u']]) {
    const queries = []
    const app = createTestApp(queries)
    t.after(() => app.close())
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: `${path}?lon0=120&lat0=20&append=${encodeURIComponent(input)}%2C%22%3BWAITFOR%20DELAY%20%270%3A0%3A1%27--%2Cunsupported`
    })

    assert.equal(response.statusCode, 200, path)
    assert.equal(queries.length, 1, path)
    assert.match(queries[0], new RegExp(`@append="${expected}"(?:;|\\s)`), path)
    assert.doesNotMatch(queries[0], /WAITFOR|unsupported|--/, path)
  }
})

test('keeps the established default append when all requested values are unsupported', async t => {
  for (const [path, expected] of [['/api/ctd', 'temperature'], ['/api/sadcp', 'u,v']]) {
    const queries = []
    const app = createTestApp(queries)
    t.after(() => app.close())
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: `${path}?lon0=120&lat0=20&append=%22%3BDELETE%20FROM%20dbo.X%3B--%2Cunsupported`
    })

    assert.equal(response.statusCode, 200, path)
    assert.equal(queries.length, 1, path)
    assert.match(queries[0], new RegExp(`@append="${expected}"(?:;|\\s)`), path)
    assert.doesNotMatch(queries[0], /DELETE|dbo\.X|unsupported|--/, path)
  }
})
