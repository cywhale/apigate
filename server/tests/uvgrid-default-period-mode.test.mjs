import assert from 'node:assert/strict'
import test from 'node:test'
import { jsonPeriodMode } from '../src/routes/apirest.mjs'

test('serializes the omitted SQL mode as valid APIverse-compatible JSON', () => {
  const header = JSON.parse(`{"periodMode":${jsonPeriodMode('NULL')},"periodArray":[0]}`)

  assert.equal(header.periodMode, 0)
  assert.deepEqual(header.periodArray, [0])
})

test('preserves explicitly selected period modes', () => {
  assert.equal(jsonPeriodMode('"0"'), '"0"')
  assert.equal(jsonPeriodMode('"monsoon"'), '"monsoon"')
})
