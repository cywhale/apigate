import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const home = '/home/odbadmin/.pm2'
const node = '/usr/bin/node'
const pm2 = '/home/odbadmin/.local/npm/lib/node_modules/pm2/bin/pm2'
const appCwd = '/home/odbadmin/proj/apigate/server'
const productionPm2Home = '/home/odbadmin/.pm2-apigate-node24'
const dump = home + '/dump.pm2'
const backups = '/home/odbadmin/backup/apigate-runtime/legacy-pm2'

export function validateLegacyApps (list, { requirePid = true, allowPartial = false } = {}) {
  assert.ok(Array.isArray(list), 'Invalid PM2 process list')
  const apigate = list.filter(item => (item.pm2_env ?? item).name === 'apigate')
  assert.ok(apigate.length <= 2, 'Found too many legacy apigate entries')
  if (!allowPartial) assert.equal(apigate.length, 2, 'Expected exactly the two legacy apigate workers in default PM2')
  const instances = new Set()
  for (const item of apigate) {
    const env = item.pm2_env ?? item
    assert.equal(env.pm_cwd, appCwd, 'Unexpected apigate cwd; refusing to retire')
    assert.equal(env.pm_exec_path, appCwd + '/src/index.mjs', 'Unexpected apigate entrypoint')
    assert.equal(env.exec_interpreter, 'node', 'Unexpected legacy interpreter')
    assert.equal(env.exec_mode, 'cluster_mode', 'Expected legacy apigate cluster')
    assert.equal(String(env.PORT ?? env.env?.PORT), '3023', 'Unexpected apigate port')
    assert.equal(env.status, 'online', 'Legacy apigate worker is not online')
    const instance = env.env?.NODE_APP_INSTANCE ?? env.NODE_APP_INSTANCE
    assert.ok(instance !== undefined && !instances.has(String(instance)), 'Missing or duplicate legacy worker instance')
    instances.add(String(instance))
    if (requirePid) {
      assert.ok(Number.isInteger(item.pid) && item.pid > 1, 'Invalid worker process')
      assert.ok(Number.isInteger(item.pm_id ?? env.pm_id), 'Invalid PM2 worker id')
    }
  }
  return apigate
}

export function unrelatedApps (list) {
  return list.filter(item => (item.pm2_env ?? item).name !== 'apigate')
    .map(item => {
      const env = item.pm2_env ?? item
      return [env.name, env.pm_cwd, env.pm_exec_path, env.exec_interpreter, env.exec_mode, env.status, env.PORT ?? env.env?.PORT, env.NODE_APP_INSTANCE ?? env.env?.NODE_APP_INSTANCE, item.pid]
    })
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
}

export function pm2Environment (pm2Home, environment = process.env) {
  return { ...environment, PM2_HOME: pm2Home }
}

export function removeLegacyApigateFromDump (saved, live) {
  assert.ok(Array.isArray(saved), 'Invalid saved PM2 dump')
  const savedApigate = validateLegacyApps(saved, { requirePid: false, allowPartial: true })
  const liveApigate = validateLegacyApps(live, { allowPartial: true })
  const identity = list => list.map(item => {
    const env = item.pm2_env ?? item
    return {
      instance: env.env?.NODE_APP_INSTANCE ?? env.NODE_APP_INSTANCE,
      cwd: env.pm_cwd,
      script: env.pm_exec_path,
      interpreter: env.exec_interpreter,
      mode: env.exec_mode,
      port: env.PORT ?? env.env?.PORT
    }
  }).sort((a, b) => Number(a.instance) - Number(b.instance))
  const savedByInstance = new Map(identity(savedApigate).map(item => [String(item.instance), item]))
  for (const current of identity(liveApigate)) {
    assert.deepEqual(current, savedByInstance.get(String(current.instance)), 'Saved legacy apigate entry does not match the live worker')
  }
  return saved.filter(item => (item.pm2_env ?? item).name !== 'apigate')
}

const command = (file, args, env = process.env) => execFileSync(file, args, {
  encoding: 'utf8',
  timeout: 60_000,
  stdio: ['ignore', 'pipe', 'pipe'],
  env
}).trim()
const systemctl = (...args) => command('/usr/bin/systemctl', args)
const pm2Command = (...args) => command(node, [pm2, ...args], pm2Environment(home))
const readList = () => JSON.parse(pm2Command('jlist'))
const sameExecutable = (pid, executable = node) => assert.equal(fs.readlinkSync(`/proc/${pid}/exe`), fs.realpathSync(executable), `Worker is not running ${executable}`)

function preflight () {
  assert.equal(process.getuid(), fs.statSync('/home/odbadmin').uid, 'Run as the odbadmin account, not through sudo')
  assert.equal(systemctl('is-active', 'pm2-odbadmin.service'), 'active', 'Default PM2 service is not active')
  assert.equal(systemctl('is-enabled', 'pm2-odbadmin.service'), 'enabled', 'Default PM2 service is not enabled')
  const daemon = fs.readFileSync(home + '/pm2.pid', 'utf8').trim()
  assert.equal(systemctl('show', '-p', 'MainPID', '--value', 'pm2-odbadmin.service'), daemon, 'Default PM2 service does not own this daemon')
  sameExecutable(daemon)

  const productionNode = fs.readFileSync('/home/odbadmin/proj/apigate/.nvmrc', 'utf8').trim()
  const productionBin = `/home/odbadmin/.nvm/versions/v${productionNode}/bin/node`
  assert.equal(systemctl('is-active', 'pm2-apigate-node24.service'), 'active', 'Dedicated production PM2 service is not active')
  assert.equal(systemctl('is-enabled', 'pm2-apigate-node24.service'), 'enabled', 'Dedicated production PM2 service is not enabled')
  const productionDaemon = fs.readFileSync(productionPm2Home + '/pm2.pid', 'utf8').trim()
  sameExecutable(productionDaemon, productionBin)
  assert.equal(systemctl('show', '-p', 'MainPID', '--value', 'pm2-apigate-node24.service'), productionDaemon, 'Dedicated production service does not own its PM2 daemon')
  const productionList = JSON.parse(command(productionBin, [pm2, 'jlist'], pm2Environment(productionPm2Home)))
  const active = productionList.filter(item => item.name === 'apigate' && item.pm2_env?.status === 'online')
  assert.equal(active.length, 2, 'New dedicated production cluster must be healthy before legacy retirement')
  for (const item of active) {
    assert.equal(item.pm2_env.exec_interpreter, productionBin, 'Production cluster uses an unexpected Node interpreter')
    assert.equal(item.pm2_env.PORT, '3025', 'Production cluster is not listening on port 3025')
    assert.equal(item.pm2_env.pm_cwd, appCwd, 'Production cluster uses an unexpected working directory')
    sameExecutable(item.pid, productionBin)
  }
  const oas = JSON.parse(command('/usr/bin/curl', ['--silent', '--fail', '--max-time', '15', 'http://127.0.0.1:3025/api/json']))
  assert.equal(oas.openapi, '3.1.0', 'Production OAS health check failed')

  const list = readList()
  const legacy = validateLegacyApps(list, { allowPartial: true })
  for (const item of legacy) sameExecutable(item.pid)
  const saved = JSON.parse(fs.readFileSync(dump, 'utf8'))
  const retainedDump = removeLegacyApigateFromDump(saved, list)
  return { legacy, retainedDump, savedLegacyCount: saved.filter(item => (item.pm2_env ?? item).name === 'apigate').length, unrelated: unrelatedApps(list) }
}

function privateBackup () {
  fs.mkdirSync(backups, { recursive: true, mode: 0o700 })
  const parent = fs.statSync(backups)
  assert.equal(parent.uid, process.getuid(), 'Backup directory must be owned by odbadmin')
  assert.equal(parent.mode & 0o077, 0, 'Backup directory must be private')
  const target = fs.mkdtempSync(backups + '/retired-')
  fs.chmodSync(target, 0o700)
  const stat = fs.statSync(dump)
  fs.copyFileSync(dump, target + '/dump.pm2')
  fs.chmodSync(target + '/dump.pm2', 0o600)
  fs.writeFileSync(target + '/owner.json', JSON.stringify({ uid: stat.uid, gid: stat.gid }), { mode: 0o600 })
  return target
}

function writeDump (entries) {
  const stat = fs.statSync(dump)
  assert.equal(stat.uid, process.getuid(), 'Default PM2 dump must be owned by odbadmin')
  const temp = dump + `.retire-${process.pid}`
  fs.writeFileSync(temp, JSON.stringify(entries, null, 2), { mode: stat.mode & 0o777, flag: 'wx' })
  try {
    fs.chownSync(temp, stat.uid, stat.gid)
    fs.chmodSync(temp, stat.mode & 0o777)
    fs.renameSync(temp, dump)
  } catch (error) {
    try { fs.unlinkSync(temp) } catch {}
    throw error
  }
}

async function main () {
  const args = process.argv.slice(2)
  assert.ok(args.length === 0 || (args.length === 1 && ['--check', '--apply'].includes(args[0])), 'Usage: retire-legacy-apigate-pm2.sh [--check|--apply]')
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  if (args[0] === '--apply') {
    assert.equal(fs.realpathSync(resolve(repo, 'server')), appCwd, 'Apply only from deployed production checkout after merge')
    assert.equal(fs.realpathSync('/home/odbadmin/proj/apigate/.nvmrc'), fs.realpathSync(resolve(repo, '.nvmrc')))
  }

  const before = preflight()
  if (args[0] !== '--apply') {
    console.log(`Read-only preflight passed; ${before.legacy.length} matching legacy worker(s) and ${before.savedLegacyCount} saved legacy entry/entries identified. No process or dump was changed.`)
    console.log(`Other PM2 application entries preserved: ${before.unrelated.length}`)
    return
  }

  const backup = privateBackup()
  console.log(`Private pre-change dump backup: ${backup}`)
  try {
    for (const item of before.legacy) pm2Command('delete', String(item.pm_id))
    const remaining = readList()
    assert.equal(remaining.some(item => (item.pm2_env ?? item).name === 'apigate'), false, 'Legacy apigate entries remain')
    assert.deepEqual(unrelatedApps(remaining), before.unrelated, 'A non-apigate PM2 entry changed')
    writeDump(before.retainedDump)
    assert.deepEqual(JSON.parse(fs.readFileSync(dump, 'utf8')), before.retainedDump, 'Unrelated saved PM2 entries were not preserved exactly')
    assert.deepEqual(unrelatedApps(readList()), before.unrelated, 'A non-apigate PM2 entry changed')
    console.log('Removed the legacy apigate workers and their saved entries; unrelated saved entries were preserved without pm2 save.')
  } catch (error) {
    throw new Error(`Legacy PM2 retirement did not complete. No whole-home resurrection was attempted; the Node 24 production service is independent. Inspect the default PM2 state and retry after review. Private dump backup: ${backup}`, { cause: error })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message.split('\n')[0])
    process.exitCode = 1
  })
}
