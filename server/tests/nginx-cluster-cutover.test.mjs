import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const transform = new URL('../scripts/transform-nginx-apigate-cluster.py', import.meta.url)

test('cluster cutover changes only the reviewed apigate upstream port', () => {
  const directory = mkdtempSync(join(tmpdir(), 'apigate-cluster-cutover-'))
  const upstreams = join(directory, 'upstreams.conf')
  writeFileSync(upstreams, `upstream other {
    server 127.0.0.1:9999;
}

upstream apigate {
    server 127.0.0.1:3024;
}
`)

  execFileSync('python3', [transform.pathname, upstreams])
  const changed = readFileSync(upstreams, 'utf8')
  assert.match(changed, /upstream other \{\n    server 127\.0\.0\.1:9999;/)
  assert.match(changed, /upstream apigate \{\n    server 127\.0\.0\.1:3025;/)
  assert.doesNotMatch(changed, /127\.0\.0\.1:3024/)
})

test('cluster cutover refuses an unexpected upstream', () => {
  const directory = mkdtempSync(join(tmpdir(), 'apigate-cluster-cutover-'))
  const upstreams = join(directory, 'upstreams.conf')
  const original = 'upstream apigate { server 127.0.0.1:9999; }\n'
  writeFileSync(upstreams, original)
  assert.throws(() => execFileSync('python3', [transform.pathname, upstreams], {
    stdio: 'pipe'
  }))
  assert.equal(readFileSync(upstreams, 'utf8'), original)
})

test('cluster cutover requires the persistent service and provides rollback', () => {
  const script = readFileSync(new URL('../scripts/apply-nginx-apigate-cluster.sh', import.meta.url), 'utf8')
  assert.match(script, /systemctl is-enabled --quiet/)
  assert.match(script, /systemctl is-active --quiet/)
  assert.match(script, /127\.0\.0\.1:3025\/api\/json/)
  assert.match(script, /nginx -t/)
  assert.match(script, /for attempt in \{1\.\.15\}/)
  assert.match(script, /restore\(\)/)
  assert.match(script, /Ports 3024 and 3023 remain running/)
})
