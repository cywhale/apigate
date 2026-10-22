import assert from 'node:assert/strict'
import { accessSync, constants } from 'node:fs'
import test from 'node:test'
import { pm2Environment, removeLegacyApigateFromDump, unrelatedApps, validateLegacyApps } from '../scripts/retire-legacy-apigate-pm2.mjs'

const apps = () => [0, 1].map(id => ({
  name: 'apigate', pm_id: id, pid: id + 100,
  pm2_env: {
    name: 'apigate', pm_cwd: '/home/odbadmin/proj/apigate/server',
    pm_exec_path: '/home/odbadmin/proj/apigate/server/src/index.mjs',
    exec_interpreter: 'node', exec_mode: 'cluster_mode', status: 'online', PORT: '3023',
    env: { NODE_APP_INSTANCE: String(id), PORT: '3023' }
  }
}))

test('matches only the two online legacy apigate 3023 workers', () => {
  assert.equal(validateLegacyApps(apps()).length, 2)
  for (const mutate of [
    list => list.push(structuredClone(list[0])),
    list => { list[0].pm2_env.PORT = '3025' },
    list => { list[0].pm2_env.pm_cwd = '/tmp/staging' },
    list => { list[1].pm2_env.exec_interpreter = '/usr/bin/node' },
    list => { list[0].pm2_env.status = 'stopped' }
  ]) {
    const value = apps()
    mutate(value)
    assert.throws(() => validateLegacyApps(value))
  }
})

test('accepts a partial legacy cluster for a safe retry and rejects duplicate identities', () => {
  const [first, second] = apps()
  assert.equal(validateLegacyApps([first], { allowPartial: true }).length, 1)
  assert.equal(validateLegacyApps([], { allowPartial: true }).length, 0)
  const duplicate = structuredClone(second)
  duplicate.pm2_env.env.NODE_APP_INSTANCE = '0'
  assert.throws(() => validateLegacyApps([first, duplicate], { allowPartial: true }), /duplicate legacy worker instance/)
})

test('keeps unrelated PM2 application entries when retiring apigate', () => {
  const all = [...apps(), {
    name: 'gebco', pm_id: 3,
    pm2_env: { name: 'gebco', pm_cwd: '/home/odbadmin/proj/gebco', pm_exec_path: 'src/index.mjs', exec_mode: 'cluster_mode', status: 'online', PORT: '3030' }
  }]
  const before = unrelatedApps(all)
  const after = unrelatedApps(all.filter(item => item.name !== 'apigate'))
  assert.deepEqual(after, before)
  accessSync(new URL('../scripts/retire-legacy-apigate-pm2.sh', import.meta.url), constants.X_OK)
})

test('queries the dedicated production PM2 home without changing other environment settings', () => {
  assert.deepEqual(pm2Environment('/pm2-production', { PM2_HOME: '/pm2-default', KEEP: 'value' }), {
    PM2_HOME: '/pm2-production', KEEP: 'value'
  })
})

test('removes only matching legacy workers from the saved dump and preserves other entries exactly', () => {
  const legacy = apps()
  const unrelated = { name: 'gebco', pm_id: 8, pm2_env: { name: 'gebco', env: { SECRET: 'must remain untouched' } } }
  const saved = [legacy[0], unrelated, legacy[1]]
  const retained = removeLegacyApigateFromDump(saved, legacy)
  assert.deepEqual(retained, [unrelated])
  assert.equal(retained[0], unrelated)
  const wrongPort = structuredClone(legacy[1])
  wrongPort.pm2_env.PORT = '3025'
  wrongPort.pm2_env.env.PORT = '3025'
  assert.throws(() => removeLegacyApigateFromDump(saved, [legacy[0], wrongPort]), /Unexpected apigate port/)
})

test('filters legacy workers from the actual flat PM2 dump while matching stable instance identity', () => {
  const flatSaved = apps().map((item, index) => ({ ...item.pm2_env, NODE_APP_INSTANCE: String(index), pm_id: undefined, pid: undefined }))
  const live = apps()
  const retained = removeLegacyApigateFromDump(flatSaved, live)
  assert.deepEqual(retained, [])
  assert.equal(validateLegacyApps(flatSaved, { requirePid: false }).length, 2)
  assert.deepEqual(flatSaved.map(item => item.NODE_APP_INSTANCE), ['0', '1'])
})
