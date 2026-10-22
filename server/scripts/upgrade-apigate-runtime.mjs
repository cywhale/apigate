import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as fs from 'node:fs'

export const production = Object.freeze({
  cwd: '/home/odbadmin/proj/apigate/server',
  home: '/home/odbadmin/.pm2-apigate-node24',
  unit: '/etc/systemd/system/pm2-apigate-node24.service',
  service: 'pm2-apigate-node24.service',
  pm2: '/home/odbadmin/.local/npm/lib/node_modules/pm2/bin/pm2',
  backups: '/home/odbadmin/backup/conf/apigate-runtime'
})
const nodePattern = /^\/home\/odbadmin\/\.nvm\/versions\/v24\.\d+\.\d+\/bin\/node$/

// Both jlist and dump contain credentials. Never print their content in errors.
export function validateProcesses (list, node, { live = false } = {}) {
  assert.ok(Array.isArray(list) && list.length === 2, 'Expected exactly two dedicated apigate entries')
  const pids = new Set()
  for (const item of list) {
    const env = item.pm2_env ?? item
    const value = key => env[key] ?? env.env?.[key]
    assert.equal(item.name ?? env.name, 'apigate', 'Unexpected application in dedicated PM2 home')
    assert.equal(env.pm_cwd, production.cwd, 'Unexpected application cwd')
    assert.equal(env.pm_exec_path, production.cwd + '/src/index.mjs', 'Unexpected application entrypoint')
    assert.equal(env.exec_mode, 'cluster_mode', 'Expected cluster mode')
    assert.equal(env.exec_interpreter, node, 'Unexpected worker interpreter')
    assert.equal(String(value('PORT')), '3025', 'Unexpected production port')
    assert.equal(String(value('APIGATE_TLS')), 'false', 'Expected HTTP upstream')
    assert.equal(value('NODE_ENV'), 'production', 'Expected production environment')
    if (live) {
      assert.equal(env.status, 'online', 'Worker is not online')
      assert.ok(Number.isInteger(item.pid) && item.pid > 1 && !pids.has(item.pid), 'Invalid worker PID')
      pids.add(item.pid)
    }
  }
  return list
}

export function rewriteDump (list, oldNode, targetNode) {
  validateProcesses(list, oldNode)
  assert.match(targetNode, nodePattern)
  const result = structuredClone(list)
  for (const item of result) {
    const env = item.pm2_env ?? item
    env.exec_interpreter = targetNode
    for (const scope of [env, env.env].filter(Boolean)) {
      if (typeof scope.PATH === 'string') {
        scope.PATH = [dirname(targetNode), ...scope.PATH.split(':').filter(path => !/^\/home\/odbadmin\/\.nvm\/versions\/v[^/]+\/bin$/.test(path))].join(':')
      }
    }
    // PM2's persisted env normally has PATH, but a minimal dump may not.
    if (!env.PATH) env.PATH = dirname(targetNode) + ':/usr/local/bin:/usr/bin:/bin'
    if (env.env && !env.env.PATH) env.env.PATH = env.PATH
  }
  return validateProcesses(result, targetNode)
}

export function validateSnapshotMatch (saved, processes) {
  const envOf = item => item.pm2_env ?? item
  // PM2 deliberately strips pm_id from dump.pm2; its stable instance variable
  // is the identity shared by the live process and the saved entry instead.
  const byInstance = list => {
    const map = new Map()
    for (const item of list) {
      const env = envOf(item)
      const id = env.NODE_APP_INSTANCE ?? env.env?.NODE_APP_INSTANCE
      assert.ok(id !== undefined && !map.has(String(id)), 'Missing or duplicate worker instance identity')
      map.set(String(id), env)
    }
    return map
  }
  const expected = byInstance(saved)
  const actual = byInstance(processes)
  assert.deepEqual([...expected.keys()].sort(), [...actual.keys()].sort(), 'Saved/live worker identities differ')
  const environment = env => {
    const keys = new Set([...Object.keys(env.env ?? {}), ...Object.keys(env).filter(key => /^[A-Z][A-Z0-9_]*$/.test(key))])
    for (const ephemeral of ['PM2_JSON_PROCESSING', 'PM2_USAGE', 'PM2_DISCRETE_MODE', 'unique_id']) keys.delete(ephemeral)
    return Object.fromEntries([...keys].sort().map(key => [key, env[key] ?? env.env?.[key]]))
  }
  for (const [id, old] of expected) {
    const current = actual.get(id)
    for (const key of ['name', 'pm_cwd', 'pm_exec_path', 'exec_mode', 'exec_interpreter', 'node_args', 'watch', 'instances']) {
      assert.deepEqual(old[key], current[key], 'Saved/live startup settings differ; review and save current PM2 state privately first')
    }
    assert.deepEqual(environment(old), environment(current), 'Saved/live environments differ; review and save current PM2 state privately first')
  }
}

export function unitNode (unit) {
  for (const pattern of [/^\[Service\]$/gm, /^User=/gm, /^Environment=PATH=/gm, /^Environment=PM2_HOME=/gm, /^PIDFile=/gm, /^ExecStart=/gm, /^ExecReload=/gm, /^ExecStop=/gm]) {
    assert.equal([...unit.matchAll(pattern)].length, 1, 'Missing or duplicate systemd directive')
  }
  const start = unit.match(/^ExecStart=(\S+) (\S+) resurrect$/m)
  assert.ok(start, 'Unsupported systemd ExecStart')
  assert.match(start[1], nodePattern)
  assert.equal(start[2], production.pm2)
  for (const [key, command] of [['ExecReload', 'reload all'], ['ExecStop', 'kill']]) {
    assert.ok(unit.split('\n').includes(`${key}=${start[1]} ${production.pm2} ${command}`), `Unsupported ${key}`)
  }
  assert.ok(unit.split('\n').includes('User=odbadmin'), 'Unsupported service user')
  assert.ok(unit.split('\n').includes(`Environment=PM2_HOME=${production.home}`), 'Wrong PM2 home')
  assert.ok(unit.split('\n').includes(`PIDFile=${production.home}/pm2.pid`), 'Wrong PM2 PIDFile')
  assert.ok(unit.includes(`Environment=PATH=${dirname(start[1])}:`), 'Wrong service PATH')
  return start[1]
}

export function rewriteUnit (unit, targetNode) {
  const oldNode = unitNode(unit)
  assert.match(targetNode, nodePattern)
  return unit.replaceAll(dirname(oldNode), dirname(targetNode))
}

// The transaction is exercised with fake adapters in tests; real side effects
// are confined to the adapter below. Preflight/backup failures never stop PM2.
export async function upgrade (adapter, apply = false) {
  const state = await adapter.preflight()
  if (!apply) return { checked: true }
  const backup = await adapter.backup(state)
  try {
    await adapter.stop()
    await adapter.install(state)
    await adapter.start()
    await adapter.verify()
    await adapter.save()
    await adapter.verifyDump()
    return { upgraded: true, backup }
  } catch (error) {
    try {
      await adapter.restore(backup)
    } catch {
      throw new Error(`Upgrade failed and automatic rollback needs operator attention. Backup: ${backup}`, { cause: error })
    }
    throw new Error(`Upgrade failed; previous runtime restored. Backup: ${backup}`, { cause: error })
  }
}

function realAdapter (repo) {
  const targetVersion = fs.readFileSync(resolve(repo, '.nvmrc'), 'utf8').trim()
  assert.match(targetVersion, /^24\.\d+\.\d+$/)
  const targetNode = `/home/odbadmin/.nvm/versions/v${targetVersion}/bin/node`
  const dump = production.home + '/dump.pm2'
  let oldNode
  let original
  const command = (file, args) => execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000 }).trim()
  const systemctl = (...args) => command('/usr/bin/systemctl', args)
  const pm2 = (node, ...args) => {
    const env = [`PM2_HOME=${production.home}`, `PATH=${dirname(node)}:/usr/local/bin:/usr/bin:/bin`, node, production.pm2, ...args]
    return process.getuid() === 0
      ? command('/usr/sbin/runuser', ['-u', 'odbadmin', '--', 'env', ...env])
      : command('/usr/bin/env', env)
  }
  const readDump = () => JSON.parse(fs.readFileSync(dump, 'utf8'))
  const readLive = node => JSON.parse(pm2(node, 'jlist'))
  const sameExecutable = (pid, node) => {
    assert.ok(/^\d+$/.test(String(pid)) && Number(pid) > 1, 'Invalid process PID')
    assert.equal(fs.readlinkSync(`/proc/${pid}/exe`), fs.realpathSync(node), 'Live executable differs from expected runtime')
  }
  const live = node => {
    // Check daemon before issuing a PM2 command: PM2 must not start a new daemon.
    const daemonPid = fs.readFileSync(production.home + '/pm2.pid', 'utf8').trim()
    sameExecutable(daemonPid, node)
    assert.equal(systemctl('show', '-p', 'MainPID', '--value', production.service), daemonPid, 'systemd does not track the dedicated daemon')
    const processes = validateProcesses(readLive(node), node, { live: true })
    for (const process of processes) sameExecutable(process.pid, node)
    return processes
  }
  const health = () => {
    const get = path => JSON.parse(command('/usr/bin/curl', ['--silent', '--show-error', '--fail', '--max-time', '20', 'http://127.0.0.1:3025' + path]))
    const oas = get('/api/json')
    assert.equal(oas.openapi, '3.1.0')
    assert.ok(oas.paths?.['/api/ctd'] && oas.paths?.['/api/sadcp'], 'Missing public API paths')
    for (const path of ['/api/ctd', '/api/sadcp']) {
      const result = get(path + '?lon0=120&lon1=123&lat0=20&lat1=25&dep0=10&limit=1')
      assert.ok(Array.isArray(result) && result.length > 0, 'API query failed or returned no known-region data')
    }
  }
  const waitHealthy = async () => {
    for (let attempt = 0; ; attempt++) {
      try { health(); return } catch (error) {
        if (attempt === 4) throw error
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }
  const writePrivate = (path, content, owner) => {
    const temporary = `${path}.runtime-upgrade-${process.pid}`
    fs.writeFileSync(temporary, content, { mode: 0o600, flag: 'wx' })
    if (owner) fs.chownSync(temporary, owner.uid, owner.gid)
    fs.renameSync(temporary, path)
  }
  const restore = async backup => {
    const canonical = fs.realpathSync(backup)
    assert.equal(dirname(canonical), production.backups, 'Unexpected backup location')
    const stat = fs.statSync(canonical)
    assert.ok(stat.uid === 0 && (stat.mode & 0o077) === 0, 'Backup must be root-owned and private')
    const unit = fs.readFileSync(canonical + '/unit', 'utf8')
    const old = unitNode(unit)
    const saved = JSON.parse(fs.readFileSync(canonical + '/dump.pm2', 'utf8'))
    validateProcesses(saved, old)
    const owner = JSON.parse(fs.readFileSync(canonical + '/owner.json', 'utf8'))
    assert.ok(Number.isInteger(owner.uid) && Number.isInteger(owner.gid), 'Invalid backup owner')
    // A failed start can leave a daemon despite an inactive service.
    systemctl('stop', production.service)
    if (fs.existsSync(production.home + '/pm2.pid')) {
      const pid = fs.readFileSync(production.home + '/pm2.pid', 'utf8').trim()
      if (/^\d+$/.test(pid) && fs.existsSync(`/proc/${pid}/exe`)) {
        const executable = fs.readlinkSync(`/proc/${pid}/exe`)
        assert.ok([old, targetNode].includes(executable), 'Refusing to stop unknown daemon')
        pm2(executable, 'kill')
      }
    }
    fs.writeFileSync(production.unit, unit, { mode: 0o644 })
    fs.chmodSync(production.unit, 0o644)
    writePrivate(dump, JSON.stringify(saved, null, 2), owner)
    systemctl('daemon-reload')
    systemctl('start', production.service)
    await waitHealthy()
    live(old)
    validateProcesses(readDump(), old)
    assert.equal(systemctl('is-active', production.service), 'active')
  }
  return {
    async preflight () {
      assert.equal(command(targetNode, ['--version']), 'v' + targetVersion, 'Target runtime mismatch')
      assert.equal(systemctl('is-active', production.service), 'active')
      assert.equal(systemctl('is-enabled', production.service), 'enabled')
      assert.equal(systemctl('show', '-p', 'FragmentPath', '--value', production.service), production.unit, 'Unexpected loaded unit')
      assert.equal(systemctl('show', '-p', 'DropInPaths', '--value', production.service), '', 'Service overrides require manual review')
      original = fs.readFileSync(production.unit, 'utf8')
      oldNode = unitNode(original)
      const processes = live(oldNode)
      const saved = readDump()
      validateProcesses(saved, oldNode)
      validateSnapshotMatch(saved, processes)
      const config = createRequire(import.meta.url)(resolve(repo, 'server/ops/ecosystem.config.cjs'))
      assert.equal(config.apps.length, 1)
      const app = config.apps[0]
      assert.equal(app.name, 'apigate')
      assert.equal(app.cwd, production.cwd)
      assert.equal(app.script, 'src/index.mjs')
      assert.equal(app.instances, 2)
      assert.equal(app.exec_mode, 'cluster')
      assert.equal(app.interpreter, targetNode)
      assert.equal(app.watch, false)
      const nodeArgs = value => Array.isArray(value) ? value.join(' ') : value
      for (const item of saved) {
        const env = item.pm2_env ?? item
        assert.equal(env.watch ?? false, app.watch, 'Unexpected saved watch setting')
        assert.equal(nodeArgs(env.node_args), nodeArgs(app.node_args), 'Unexpected saved Node arguments')
        assert.equal(env.env?.NODE_OPTIONS ?? env.NODE_OPTIONS, app.env.NODE_OPTIONS, 'Unexpected saved Node options')
      }
      assert.equal(String(app.env.PORT), '3025')
      assert.equal(app.env.APIGATE_TLS, 'false')
      assert.equal(app.env.NODE_ENV, 'production')
      health()
      return { unit: rewriteUnit(original, targetNode), dump: rewriteDump(saved, oldNode, targetNode), owner: fs.statSync(dump) }
    },
    async backup (state) {
      fs.mkdirSync(production.backups, { recursive: true, mode: 0o700 })
      const parent = fs.statSync(production.backups)
      assert.ok(parent.uid === 0 && (parent.mode & 0o077) === 0, 'Backup parent must be root-owned and private')
      const backup = fs.mkdtempSync(production.backups + '/upgrade-')
      fs.chmodSync(backup, 0o700)
      fs.writeFileSync(backup + '/unit', original, { mode: 0o600 })
      fs.copyFileSync(dump, backup + '/dump.pm2')
      fs.chmodSync(backup + '/dump.pm2', 0o600)
      fs.writeFileSync(backup + '/owner.json', JSON.stringify({ uid: state.owner.uid, gid: state.owner.gid }), { mode: 0o600 })
      console.log('Private rollback backup: ' + backup)
      console.log(`Rollback: sudo bash ${resolve(repo, 'server/scripts/upgrade-apigate-runtime.sh')} --rollback ${backup}`)
      return backup
    },
    async stop () { systemctl('stop', production.service) },
    async install (state) {
      writePrivate(dump, JSON.stringify(state.dump, null, 2), state.owner)
      fs.writeFileSync(production.unit, state.unit)
    },
    async start () { systemctl('daemon-reload'); systemctl('start', production.service) },
    async verify () {
      await waitHealthy()
      live(targetNode)
      assert.equal(systemctl('is-active', production.service), 'active')
      assert.equal(systemctl('is-enabled', production.service), 'enabled')
      assert.equal(unitNode(fs.readFileSync(production.unit, 'utf8')), targetNode)
    },
    async save () { pm2(targetNode, 'save') },
    async verifyDump () { validateProcesses(readDump(), targetNode) },
    restore
  }
}

async function main () {
  const args = process.argv.slice(2)
  assert.ok(args.length === 0 || (args.length === 1 && ['--check', '--apply'].includes(args[0])) || (args.length === 2 && args[0] === '--rollback'), 'Usage: upgrade-apigate-runtime.sh [--check|--apply|--rollback BACKUP]')
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  if (args[0] !== '--check' && args.length) {
    assert.equal(process.getuid(), 0, 'Run apply/rollback with sudo')
    assert.equal(fs.realpathSync(resolve(repo, 'server')), production.cwd, 'Apply/rollback only from the deployed production checkout after merge')
  }
  const adapter = realAdapter(repo)
  const mutating = ['--apply', '--rollback'].includes(args[0])
  const lock = '/run/lock/apigate-runtime-upgrade'
  if (mutating) fs.mkdirSync(lock, { mode: 0o700 })
  try {
    if (args[0] === '--rollback') {
      await adapter.restore(args[1])
      console.log('Previous runtime restored and verified.')
    } else {
      const result = await upgrade(adapter, args[0] === '--apply')
      console.log(result.upgraded ? 'Runtime upgraded; daemon, workers, health and saved dump verified.' : 'Read-only preflight passed. --apply performs a brief production maintenance restart.')
    }
  } finally {
    if (mutating) fs.rmdirSync(lock)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Assertion operands and subprocess output can contain secrets; print only
    // the explicit message, never a stack/dump/stdout/stderr.
    console.error(error.message.split('\n')[0])
    process.exitCode = 1
  })
}
