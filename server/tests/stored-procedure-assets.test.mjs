import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const baselineUrl = new URL('../../database/stored-procedures/baseline-2026-09-09/', import.meta.url)

test('versions the six supplied stored-procedure snapshots separately from deployment', async () => {
  const files = (await readdir(baselineUrl)).sort()
  assert.deepEqual(files, [
    'ctdavg.sql', 'ctdgridqry.sql', 'ctdqry.sql',
    'sadcpavg.sql', 'sadcpgridqry.sql', 'sadcpqry.sql'
  ])

  const policy = await readFile(new URL('../../database/README.md', import.meta.url), 'utf8')
  assert.match(policy, /not.*automatic deployment/i)
  assert.match(policy, /read-only/i)
})

test('keeps the known sadcpavg syntax defect visible until its isolated fix slice', async () => {
  const sql = await readFile(new URL('sadcpavg.sql', baselineUrl), 'utf8')
  assert.match(sql, /ORDER BY longitude DESC,\s*latitude DESC,/i)
})

test('diagnostic collection remains read-only and targets SQL Server metadata', async () => {
  const sql = await readFile(new URL('../../database/diagnostics/sqlserver-2019-readonly.sql', import.meta.url), 'utf8')
  assert.match(sql, /compatibility_level/i)
  assert.match(sql, /sys\.sql_expression_dependencies/i)
  assert.match(sql, /VIEW_CTD_GRID15MOA_2015/)
  assert.match(sql, /VIEW_SADCP_MEASURED_2015/)
  assert.match(sql, /WHILE @inserted > 0/)
  assert.match(sql, /sys\.indexes/i)
  assert.match(sql, /sys\.dm_db_partition_stats/i)
  assert.doesNotMatch(sql, /^\s*(?:UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE)\b/im)
  assert.doesNotMatch(sql, /^\s*INSERT\s+(?!INTO\s+@)/im)
})
