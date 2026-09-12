import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const readRepositoryFile = relativePath => readFile(resolve(repositoryRoot, relativePath), 'utf8')

test('keeps security/publication guidance and runtime handoff rules explicit', async () => {
  const [agents, docsMap, policy] = await Promise.all([
    readRepositoryFile('AGENTS.md'),
    readRepositoryFile('specs/docs/README.md'),
    readRepositoryFile('specs/docs/security-and-publication-policy-2026-09.md')
  ])

  assert.doesNotMatch(agents, /odb_ctd_sadcp_v1/)
  assert.match(agents, /interactive shell, use nvm use 24\.20\.0/)
  assert.match(agents, /systemd does not source nvm/)
  assert.match(agents, /absolute Node 24 binary and PM2_HOME/)
  assert.match(agents, /Knex 3 and Tedious 20/)
  assert.match(agents, /lru-cache 11/)

  assert.match(docsMap, /security and publication policy/)
  assert.match(policy, /## Dynamic SQL and injection/)
  assert.match(policy, /## Denial of service/)
  assert.match(policy, /internal `sp_executesql` bindings do not make Fastify's outer `EXEC` string parameterized/)
  assert.match(policy, /not application source and should not be committed/i)
  assert.match(policy, /must not claim to prove arbitrary SQL safety inside SQL Server/i)
})
