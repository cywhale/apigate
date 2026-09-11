import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sourceUrl = new URL('../src/srvapp.mjs', import.meta.url)

test('awaits and catches the startup database probe', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  const probeBlock = source.match(/const data = await sqldb\.raw\([\s\S]*?Startup database probe failed; continuing without probe[\s\S]*?\n\s*\}\)/)?.[0]

  assert.ok(probeBlock, 'startup probe should remain inside an async error boundary')
  assert.match(probeBlock, /const data = await sqldb\.raw\(/)
  assert.match(probeBlock, /fastify\.log\.error\(\{ actor: 'Knex', err \}/)
  assert.doesNotMatch(probeBlock, /\.then\(/)
})
