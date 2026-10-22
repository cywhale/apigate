import assert from 'node:assert/strict'
import { accessSync, constants, readFileSync } from 'node:fs'
import test from 'node:test'
import { production, rewriteDump, rewriteUnit, unitNode, upgrade, validateProcesses, validateSnapshotMatch } from '../scripts/upgrade-apigate-runtime.mjs'

const oldNode = '/home/odbadmin/.nvm/versions/v24.20.0/bin/node'
const pinned = readFileSync(new URL('../../.nvmrc', import.meta.url), 'utf8').trim()
const newNode = `/home/odbadmin/.nvm/versions/v${pinned}/bin/node`
const entries = () => [0, 1].map(id => ({
  name: 'apigate', pm_id: id, pid: 100 + id,
  pm2_env: {
    name: 'apigate', pm_cwd: production.cwd,
    pm_exec_path: production.cwd + '/src/index.mjs',
    exec_mode: 'cluster_mode', exec_interpreter: oldNode, status: 'online',
    PORT: '3025', APIGATE_TLS: 'false', NODE_ENV: 'production',
    PATH: oldNode.replace('/node', '') + ':/usr/bin', SQLPASS: 'fixture-not-a-real-secret',
    env: { PATH: oldNode.replace('/node', '') + ':/usr/bin', SQLPASS: 'fixture-not-a-real-secret', unique_id: `saved-${id}` }
  }
}))
const unit = `[Service]\nUser=odbadmin\nEnvironment=PM2_HOME=${production.home}\nPIDFile=${production.home}/pm2.pid\nEnvironment=PATH=${oldNode.replace('/node', '')}:/usr/bin\nExecStart=${oldNode} ${production.pm2} resurrect\nExecReload=${oldNode} ${production.pm2} reload all\nExecStop=${oldNode} ${production.pm2} kill\n`

test('transforms only interpreter/PATH and preserves saved application environment', () => {
  const source = entries()
  const changed = rewriteDump(source, oldNode, newNode)
  assert.equal(source[0].pm2_env.exec_interpreter, oldNode)
  for (const item of changed) {
    assert.equal(item.pm2_env.exec_interpreter, newNode)
    assert.equal(item.pm2_env.PATH, newNode.replace('/node', '') + ':/usr/bin')
    assert.equal(item.pm2_env.env.PATH, item.pm2_env.PATH)
    assert.equal(item.pm2_env.SQLPASS, 'fixture-not-a-real-secret')
    assert.equal(item.pm2_env.env.SQLPASS, 'fixture-not-a-real-secret')
    assert.equal(item.pm2_env.PORT, '3025')
  }
  const flat = source.map(item => item.pm2_env)
  assert.equal(rewriteDump(flat, oldNode, newNode)[0].exec_interpreter, newNode)
})

test('rejects mixed homes, stale runtime, wrong port, unexpected scripts and unhealthy workers', () => {
  for (const mutate of [
    list => list.push(structuredClone(list[0])),
    list => { list[0].name = 'other-project' },
    list => { list[0].pm2_env.PORT = '3023' },
    list => { list[0].pm2_env.pm_cwd = '/tmp/staging' },
    list => { list[0].pm2_env.pm_exec_path = '/tmp/other.mjs' },
    list => { list[0].pm2_env.exec_interpreter = '/usr/bin/node' },
    list => { list[0].pm2_env.APIGATE_TLS = 'true' },
    list => { list[0].pm2_env.status = 'stopped' },
    list => { list[1].pid = list[0].pid }
  ]) {
    const list = entries()
    mutate(list)
    assert.throws(() => validateProcesses(list, oldNode, { live: true }))
  }
})

test('updates all systemd runtime references while retaining service isolation', () => {
  const result = rewriteUnit(unit, newNode)
  assert.equal(unitNode(result), newNode)
  assert.equal(result.includes(oldNode), false)
  assert.ok(result.includes('Environment=PM2_HOME=' + production.home))
  assert.throws(() => rewriteUnit(unit.replace('User=odbadmin', 'User=root'), newNode))
  assert.throws(() => rewriteUnit(unit.replace(' resurrect', ' start all'), newNode))
  assert.throws(() => rewriteUnit(unit, '/usr/bin/node'))
})

test('keeps the production and compatibility launchers executable', () => {
  accessSync(new URL('../scripts/upgrade-apigate-runtime.sh', import.meta.url), constants.X_OK)
  accessSync(new URL('../pm2.sh', import.meta.url), constants.X_OK)
})

test('matches saved workers to live workers by their stable cluster instance and environment', () => {
  const saved = entries()
  const live = structuredClone(saved)
  for (const [index, item] of live.entries()) {
    item.pm2_env.NODE_APP_INSTANCE = index
    item.pm2_env.env.NODE_APP_INSTANCE = index
    item.pm2_env.env.unique_id = `live-${index}`
    delete item.pm_id
  }
  for (const [index, item] of saved.entries()) {
    item.pm2_env.NODE_APP_INSTANCE = index
    item.pm2_env.env.NODE_APP_INSTANCE = index
  }
  validateSnapshotMatch(saved, live)
  assert.throws(() => validateSnapshotMatch(saved, live.slice(1)))
  const stale = structuredClone(live)
  stale[0].pm2_env.SQLPASS = 'different-fixture-value'
  stale[0].pm2_env.env.SQLPASS = 'different-fixture-value'
  assert.throws(() => validateSnapshotMatch(saved, stale))
})

function fixture (failure, rollbackFailure = false) {
  const calls = []
  let current = 'old'
  const adapter = {}
  for (const operation of ['preflight', 'backup', 'stop', 'install', 'start', 'verify', 'save', 'verifyDump', 'restore']) {
    adapter[operation] = async () => {
      calls.push(operation)
      if (operation === failure || (operation === 'restore' && rollbackFailure)) throw new Error('fixture failure')
      if (operation === 'install') current = 'new'
      if (operation === 'restore') current = 'old'
      if (operation === 'backup') return '/private/fixture-backup'
      if (operation === 'preflight') return { fixture: true }
    }
  }
  return { adapter, calls, current: () => current }
}

test('default/check performs only preflight; apply saves only after runtime health', async () => {
  const check = fixture()
  assert.deepEqual(await upgrade(check.adapter), { checked: true })
  assert.deepEqual(check.calls, ['preflight'])
  const apply = fixture()
  assert.equal((await upgrade(apply.adapter, true)).upgraded, true)
  assert.deepEqual(apply.calls, ['preflight', 'backup', 'stop', 'install', 'start', 'verify', 'save', 'verifyDump'])
  assert.equal(apply.current(), 'new')
})

test('preflight/backup failures leave production untouched; later failures restore the backup', async () => {
  for (const failure of ['preflight', 'backup', 'stop', 'install', 'start', 'verify', 'save', 'verifyDump']) {
    const run = fixture(failure)
    await assert.rejects(upgrade(run.adapter, true))
    assert.equal(run.current(), 'old', failure)
    if (['preflight', 'backup'].includes(failure)) assert.ok(!run.calls.includes('stop'))
    else assert.equal(run.calls.at(-1), 'restore')
    if (['stop', 'install', 'start', 'verify'].includes(failure)) assert.ok(!run.calls.includes('save'))
  }
  const failedRollback = fixture('verify', true)
  await assert.rejects(upgrade(failedRollback.adapter, true), /operator attention.*fixture-backup/)
})
