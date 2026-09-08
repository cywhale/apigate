import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import knex from 'knex'
import { LRUCache } from 'lru-cache'

test('loads the upgraded SQL Server and cache dependencies', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(packageJson.dependencies.knex, '^3.3.0')
  assert.equal(packageJson.dependencies.tedious, '^20.3.0')
  assert.equal(packageJson.dependencies['lru-cache'], '^11.5.2')
})

test('keeps Knex MSSQL raw-query compilation and streaming available', async (t) => {
  const database = knex({ client: 'mssql' })
  t.after(() => database.destroy())

  const query = database.raw('SELECT ? AS value', [1])
  assert.deepEqual(query.toSQL().bindings, [1])
  assert.equal(query.toSQL().sql, 'SELECT ? AS value')
  assert.equal(typeof query.stream, 'function')
})

test('keeps the lru-cache API used by the stream cache', () => {
  const cache = new LRUCache({ max: 2, ttl: 60_000 })
  cache.set('ctd', 'first')
  cache.set('sadcp', 'second')

  assert.equal(cache.get('ctd'), 'first')
  cache.set('third', 'third')
  assert.equal(cache.has('sadcp'), false)
  assert.equal(cache.get('third'), 'third')
})
