import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import buildApp from '../src/app.mjs'

const testConfig = {
  SQLSERVER: '127.0.0.1', SQLPORT: 1433, SQLDBNAME: 'test',
  SQLUSER: 'test', SQLPASS: 'test', TABLE_CTD: 'ctd', TABLE_SADCP: 'sadcp',
  DOMAIN: 'localhost'
}

test('keeps the isolated NGINX fixture on loopback with an HTTP upstream', async () => {
  const config = await readFile(new URL('nginx-tls-off.conf', import.meta.url), 'utf8')

  assert.match(config, /listen 127\.0\.0\.1:13028 ssl;/)
  assert.match(config, /proxy_pass http:\/\/127\.0\.0\.1:13029;/)
  assert.match(config, /proxy_set_header X-Forwarded-Proto \$scheme;/)
  assert.match(config, /proxy_buffering off;/)
})

test('trusts NGINX forwarded HTTPS metadata', async (t) => {
  const app = buildApp({
    fastifyOptions: { logger: false },
    configure: (instance) => instance.get('/proxy-probe', (request) => ({
      protocol: request.protocol,
      host: request.host,
      ip: request.ip
    })),
    envData: testConfig,
    appOptions: { enableDatabase: false, enableStartupCacheProbe: false }
  })
  t.after(() => app.close())
  await app.ready()

  const response = await app.inject({
    method: 'GET',
    url: '/proxy-probe',
    headers: {
      host: 'ecodata.odb.ntu.edu.tw',
      'x-forwarded-for': '203.0.113.8',
      'x-forwarded-proto': 'https'
    }
  })

  assert.deepEqual(response.json(), {
    protocol: 'https',
    host: 'ecodata.odb.ntu.edu.tw',
    ip: '203.0.113.8'
  })
})
