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
  envData: testConfig,
  appOptions: { enableDatabase: false, enableStartupCacheProbe: false }
})
const operation = (specification, path) => specification.paths[path].get

test('documents the existing format-dependent response shapes', async (t) => {
  const app = createTestApp()
  t.after(() => app.close())
  await app.ready()
  const specification = app.swagger()
  const sadcpSchemas = operation(specification, '/api/sadcp')
    .responses['200'].content['application/json'].schema.oneOf
  const ctdSchemas = operation(specification, '/api/ctd')
    .responses['200'].content['application/json'].schema.oneOf
  assert.deepEqual(sadcpSchemas.map(({ title }) => title), [
    'SadcpJsonArray', 'SadcpGeoJson', 'SadcpUvGrid'
  ])
  assert.deepEqual(ctdSchemas.map(({ title }) => title), ['CtdJsonArray', 'CtdGeoJson'])
  assert.equal(sadcpSchemas[0].type, 'array')
  assert.deepEqual(sadcpSchemas[1].properties.type.enum, ['FeatureCollection'])
  assert.equal(sadcpSchemas[1].properties.features.type, 'array')
  assert.deepEqual(sadcpSchemas[2].required, ['header', 'data'])
  assert.equal(ctdSchemas[0].type, 'array')
  assert.deepEqual(ctdSchemas[1].properties.type.enum, ['FeatureCollection'])
})

test('keeps dep_mode and mode as string query parameters', async (t) => {
  const app = createTestApp()
  t.after(() => app.close())
  await app.ready()
  const specification = app.swagger()
  const ctdParameters = operation(specification, '/api/ctd').parameters
  const ctd = Object.fromEntries(ctdParameters.map((parameter) => [parameter.name, parameter.schema]))
  assert.equal(ctd.dep_mode.type, 'string')
  assert.deepEqual(ctd.dep_mode.anyOf, [
    { enum: ['mean', 'exact', 'range'] },
    { pattern: '^([5-9]|[1-9][0-9]+)$' }
  ])
  assert.equal(ctd.mode.type, 'string')

  const sadcpParameters = operation(specification, '/api/sadcp').parameters
  const sadcpByName = Object.fromEntries(sadcpParameters.map((parameter) => [parameter.name, parameter]))
  const sadcp = Object.fromEntries(sadcpParameters.map((parameter) => [parameter.name, parameter.schema]))
  assert.deepEqual(sadcp.dep_mode, {
    type: 'string',
    enum: ['mean', 'exact', 'range']
  })
  assert.equal(sadcpByName.dep_mode.description, 'Optional, mean: depth-averaged; exact: one depth specified by dep0; range: use the dep0/dep1 interval')
  assert.equal(sadcp.mode.type, 'string')
})

test('accepts established string values and rejects undocumented values before the handler', async (t) => {
  const app = createTestApp()
  t.after(() => app.close())
  await app.ready()
  for (const query of ['dep_mode=5', 'dep_mode=mean', 'mode=0', 'mode=18', 'mode=monsoon']) {
    const response = await app.inject(`/api/ctd?lon0=120&lat0=20&${query}`)
    assert.notEqual(response.statusCode, 400, query)
  }
  for (const query of ['dep_mode=4', 'dep_mode=invalid', 'mode=19', 'mode=invalid']) {
    const response = await app.inject(`/api/ctd?lon0=120&lat0=20&${query}`)
    assert.equal(response.statusCode, 400, query)
  }

  for (const query of ['dep_mode=mean', 'dep_mode=exact', 'dep_mode=range']) {
    const response = await app.inject(`/api/sadcp?lon0=120&lat0=20&${query}`)
    assert.notEqual(response.statusCode, 400, `SADCP ${query}`)
  }
  const numericSadcp = await app.inject('/api/sadcp?lon0=120&lat0=20&dep_mode=5')
  assert.equal(numericSadcp.statusCode, 400, 'SADCP numeric dep_mode')
})
