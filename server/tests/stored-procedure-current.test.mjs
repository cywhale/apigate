import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const currentUrl = new URL('../../database/stored-procedures/current/', import.meta.url)

const readCurrent = (name) => readFile(new URL(name, currentUrl), 'utf8')

test('versions the deployed 2026-09-11 procedure sources separately from baseline', async () => {
  assert.deepEqual((await readdir(currentUrl)).sort(), ['ctdavg.sql', 'sadcpavg.sql'])
})

for (const name of ['ctdavg.sql', 'sadcpavg.sql']) {
  test(`${name} compares nvarchar time_period values without implicit integer conversion`, async () => {
    const sql = await readCurrent(name)
    const activeSql = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "")

    assert.match(activeSql, /time_period=''0''/i)
    assert.match(activeSql, /time_period=''0''/i)
    assert.match(activeSql, /IN \(''1'',''2'',''3'',''4'',''5'',''6'',''7'',''8'',''9'',''10'',''11'',''12''\)/)
    assert.doesNotMatch(activeSql, /^[^\r\n-]*SET @periodqry = .*convert\(int,@mode\)/mi)
    assert.doesNotMatch(activeSql, /^[^\r\n-]*SET @periodqry = .*time_period=0\b/mi)
  })
}

test('keeps the deployed ctdavg threshold predicate and sadcpavg order fix', async () => {
  const ctd = await readCurrent('ctdavg.sql')
  const sadcp = await readCurrent('sadcpavg.sql')

  assert.match(ctd, /IF \(@dep_mode = 'mean' OR @depas > 0\)[\s\S]*?\+ @having;/)
  assert.match(sadcp, /ORDER BY longitude DESC, latitude DESC'/)
  assert.doesNotMatch(sadcp, /ORDER BY longitude DESC, latitude DESC,'/)
})
