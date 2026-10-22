import assert from 'node:assert/strict'
import test from 'node:test'
import Fastify from 'fastify'
import knexPlugin from '../src/config/knexconn.js'

test('closes Fastify after destroying the Knex pool without a database connection', { timeout: 2000 }, async () => {
  const app = Fastify({ logger: false })
  app.register(knexPlugin, { knexName: 'sqldb', knexOptions: { client: 'mssql', connection: { host: '127.0.0.1' }, pool: { min: 0 } } })
  await app.ready()
  const pool = app.sqldb.client.pool
  assert.ok(pool)
  await app.close()
  assert.equal(pool.destroyed, true)
  assert.equal(app.sqldb.client.pool, undefined)
})

test('waits for pool cleanup and propagates a pool close failure', { timeout: 2000 }, async () => {
  for (const failure of [false, true]) {
    const app = Fastify({ logger: false })
    app.register(knexPlugin, { knexName: 'sqldb', knexOptions: { client: 'mssql' } })
    await app.ready()
    const originalDestroy = app.sqldb.client.destroy.bind(app.sqldb.client)
    let finish
    app.sqldb.client.destroy = () => new Promise((resolve, reject) => {
      finish = async () => {
        await originalDestroy()
        if (failure) reject(new Error('fixture pool shutdown failure'))
        else resolve()
      }
    })
    let settled = false
    const closing = app.close()
    // Attach both handlers immediately so the deliberate rejection is handled.
    const result = closing.then(() => { settled = true; return null }, error => { settled = true; return error })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(settled, false, 'Fastify must wait for pool cleanup')
    assert.equal(typeof finish, 'function')
    await finish()
    const error = await result
    if (failure) assert.match(error.message, /fixture pool shutdown failure/)
    else assert.equal(error, null)
    assert.equal(app.sqldb.client.pool, undefined)
  }
})
