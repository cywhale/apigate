import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import cors from '@fastify/cors'
import env from '@fastify/env'
import fastifyPlugin from 'fastify-plugin'
import S from 'fluent-json-schema'

test('loads the upgraded Fastify support dependencies', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

  assert.equal(packageJson.dependencies['@fastify/cors'], '^11.3.0')
  assert.equal(packageJson.dependencies['@fastify/env'], '^7.0.0')
  assert.equal(packageJson.dependencies['fastify-plugin'], '^6.0.0')
  assert.equal(packageJson.dependencies['fluent-json-schema'], '6.0.1')
  assert.equal(typeof cors, 'function')
  assert.equal(typeof env, 'function')
  assert.equal(typeof fastifyPlugin, 'function')
})

test('keeps fluent schema construction used by environment validation', () => {
  const schema = S.object()
    .prop('SQLPORT', S.integer().required())
    .valueOf()

  assert.deepEqual(schema.required, ['SQLPORT'])
  assert.equal(schema.properties.SQLPORT.type, 'integer')
})
