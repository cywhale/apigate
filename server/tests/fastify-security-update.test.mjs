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
  configure: (app) => app.addHook('preHandler', async (request, reply) => {
    return reply.code(204).send()
  }),
  envData: testConfig,
  appOptions: {
    enableDatabase: false,
    enableStartupCacheProbe: false
  }
})

const readModuleVersion = async (packageName) => {
  const packageUrl = import.meta.resolve(`${packageName}/package.json`)
  const packageJson = JSON.parse(await readFile(new URL(packageUrl), 'utf8'))
  return packageJson.version
}

test('loads the patched Fastify dependency versions', async () => {
  assert.equal(await readModuleVersion('fastify'), '5.12.3')
  assert.equal(await readModuleVersion('@fastify/swagger'), '9.8.1')
  assert.equal(await readModuleVersion('@fastify/autoload'), '6.5.0')
})

test('keeps APIverse query values valid after the Fastify update', async (t) => {
  const app = createTestApp()
  t.after(() => app.close())
  await app.ready()

  const queryCases = [
    'dep_mode=5',
    'dep_mode=mean',
    'mode=0',
    'mode=13',
    'mode=monsoon'
  ]

  for (const query of queryCases) {
    const response = await app.inject({
      method: 'GET',
      url: `/api/ctd?lon0=120&lat0=20&${query}`
    })

    assert.equal(response.statusCode, 204, query)
  }
})

test('continues to reject invalid numeric coordinates', async (t) => {
  const app = createTestApp()
  t.after(() => app.close())
  await app.ready()

  const response = await app.inject({
    method: 'GET',
    url: '/api/ctd?lon0=not-a-number&lat0=20'
  })

  assert.equal(response.statusCode, 400)
})
