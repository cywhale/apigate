import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routeUrl = new URL('../src/routes/apirest.mjs', import.meta.url)

test('resolves the SQL response promise when the stream finishes', async () => {
  const source = await readFile(routeUrl, 'utf8')
  const finishBlock = source.match(/src\.on\('finish',[\s\S]*?\n\s*\}\)\n\s*\/\/res\.send\(src\.pipe\(stringify\(\)\)\)/)?.[0]

  assert.ok(finishBlock, 'SQL stream finish handler should remain present')
  assert.match(finishBlock, /\bresolve\(\)/)
  assert.doesNotMatch(finishBlock, /\bresolve\s*\n/)
})

test('does not cache a failed SQL stream and uses a gateway error before output starts', async () => {
  const source = await readFile(routeUrl, 'utf8')
  const errorBlock = source.match(/const fail = err => \{[\s\S]*?\n\s*\}\n\s*\/\*src/mi)?.[0]

  assert.ok(errorBlock, 'SQL stream failure handler should remain present')
  assert.match(errorBlock, /cacheout\.destroy\(\)/)
  assert.match(errorBlock, /reply\.code\(503\)\.send\(/)
  assert.match(errorBlock, /res\.raw\.destroy\(\)/)
})
