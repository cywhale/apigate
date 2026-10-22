// Explicit opt-in: this connects to the real SQL Server with SELECT-only API queries.
// APIGATE_SQL_SMOKE_ENV=/absolute/path/to/.env node --test tests/runtime-sql-smoke.integration.mjs
// Keep outside tests/*.test.mjs so ordinary CI never connects to the database.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import test from 'node:test'
import buildApp from '../src/app.mjs'

const envFile = process.env.APIGATE_SQL_SMOKE_ENV
const port = Number(process.env.APIGATE_SQL_SMOKE_PORT || 13024)
const box = 'lon0=122&lon1=122.25&lat0=23&lat1=23.25&dep0=10&dep1=100&dep_mode=mean&mean_threshold=1'
const cases = [
  ['CTD all-span JSON', `/api/ctd?${box}&format=json&limit=5`],
  ['CTD monthly GeoJSON', `/api/ctd?${box}&start=2010-01-01&end=2015-12-31&format=geojson&limit=5`],
  ['SADCP all-span JSON', `/api/sadcp?${box}&format=json&limit=5`],
  ['SADCP monthly GeoJSON', `/api/sadcp?${box}&start=2010-01-01&end=2015-12-31&format=geojson&limit=5`],
  ['SADCP UV grid', `/api/sadcp?${box}&format=uvgrid`]
]

const normalize = data => {
  // Existing SQL row ordering is not a guaranteed tie-breaker. Compare record
  // multisets for JSON/GeoJSON; UV-grid order remains semantically significant.
  if (Array.isArray(data)) return data.map(row => JSON.stringify(row)).sort()
  if (data.type === 'FeatureCollection') return data.features.map(row => JSON.stringify(row)).sort()
  return data
}

const fetchPayload = async url => {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  assert.equal(response.status, 200, new URL(url).pathname)
  const body = await response.text()
  assert.ok(Buffer.byteLength(body) < 1_000_000, 'small smoke response must stay under 1 MB')
  const data = JSON.parse(body)
  const records = Array.isArray(data) ? data : data.type === 'FeatureCollection' ? data.features : data.data
  assert.ok(Array.isArray(records) && records.length > 0, 'smoke query must return data')
  return { body, data, records: records.length }
}

test('compares the patched runtime against the production API using bounded SQL queries', {
  skip: !envFile,
  timeout: 900_000
}, async t => {
  assert.ok(isAbsolute(envFile), 'explicit absolute env file path is required')
  assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535 && ![3023, 3024, 3025].includes(port))
  const pinned = (await readFile(new URL('../../.nvmrc', import.meta.url), 'utf8')).trim()
  assert.equal(process.versions.node, pinned)
  const app = buildApp({
    envFile,
    fastifyOptions: { logger: false, trustProxy: false },
    appOptions: { enableStartupCacheProbe: false }
  })
  t.after(() => app.close())
  await app.listen({ host: '127.0.0.1', port })
  const base = `http://127.0.0.1:${port}`
  const specification = await fetch(`${base}/api/json`).then(response => response.json())
  assert.equal(specification.openapi, '3.1.0')

  for (const [name, path] of cases) {
    process.stdout.write(`SQL smoke: ${name}\n`)
    const candidate = await fetchPayload(`${base}${path}`)
    const repeated = await fetchPayload(`${base}${path}`)
    assert.equal(repeated.body, candidate.body, `${name}: repeated/cache response`)
    const production = await fetchPayload(`http://127.0.0.1:3025${path}`)
    assert.deepEqual(normalize(candidate.data), normalize(production.data), `${name}: production records`)
    t.diagnostic(`${name}: ${candidate.records} records, ${Buffer.byteLength(candidate.body)} bytes; repeat and production match`)
  }
})
