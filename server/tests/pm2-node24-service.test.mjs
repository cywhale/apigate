import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const unit = readFileSync(new URL('../ops/pm2-apigate-node24.service', import.meta.url), 'utf8')
const installer = readFileSync(new URL('../scripts/install-apigate-node24-service.sh', import.meta.url), 'utf8')
const pinned = readFileSync(new URL('../../.nvmrc', import.meta.url), 'utf8').trim()

test('isolates apigate in a dedicated Node 24 PM2 systemd service', () => {
  assert.match(unit, /^User=odbadmin$/m)
  assert.match(unit, /^Environment=PM2_HOME=\/home\/odbadmin\/\.pm2-apigate-node24$/m)
  assert.match(unit, /^PIDFile=\/home\/odbadmin\/\.pm2-apigate-node24\/pm2\.pid$/m)
  const node = `/home/odbadmin/.nvm/versions/v${pinned}/bin/node`
  for (const [directive, command] of [['ExecStart', 'resurrect'], ['ExecReload', 'reload all'], ['ExecStop', 'kill']]) {
    assert.ok(unit.split('\n').includes(`${directive}=${node} /home/odbadmin/.local/npm/lib/node_modules/pm2/bin/pm2 ${command}`))
  }
  assert.ok(unit.includes(`Environment=PATH=${node.slice(0, -5)}:`))
  assert.doesNotMatch(unit, /pm2-odbadmin|\.pm2\/pm2\.pid/)
})

test('installer proves two-worker cluster resurrection before NGINX cutover', () => {
  assert.match(installer, /127\.0\.0\.1:3025\/api\/json/)
  assert.match(installer, /exec_mode === 'cluster_mode'/)
  assert.match(installer, /worker_count.*-ne 2/)
  assert.match(installer, /as_odbadmin save/)
  assert.match(installer, /as_odbadmin kill/)
  assert.match(installer, /systemctl start/)
  assert.match(installer, /for attempt in \{1\.\.30\}/)
  assert.match(installer, /systemctl is-active --quiet/)
})
