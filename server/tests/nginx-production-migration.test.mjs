import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const transform = new URL('../scripts/transform-nginx-apigate-tls-off.py', import.meta.url)

const apiBlock = `location ^~ /api {
  add_header Access-Control-Allow-Origin "*" always;
  proxy_redirect off;
  proxy_pass https://apigate;
  include /etc/nginx/conf2.d/aio_cache_proxy.conf;
}
`

const retiredBlocks = `
location /bio {
  proxy_redirect off;
  proxy_pass https://apigate;
  include /etc/nginx/conf2.d/aio_cache_proxy.conf;
}

# GraphQL/search-like calls are intentionally not cached.
location /gql {
  add_header Access-Control-Allow-Origin "*" always;
  proxy_redirect off;
  proxy_pass https://apigate;
  include /etc/nginx/conf2.d/proxy_pass_snippet.conf;
}
`

test('production migration switches only apigate to the HTTP candidate', () => {
  const directory = mkdtempSync(join(tmpdir(), 'apigate-nginx-migration-'))
  const routes = join(directory, 'routes.conf')
  const upstreams = join(directory, 'upstreams.conf')
  writeFileSync(routes, `before\n${apiBlock}${retiredBlocks}\nafter\n`)
  writeFileSync(upstreams, `upstream other { server 127.0.0.1:9999; }\n\nupstream apigate {\n    server 127.0.0.1:3023;\n}\n`)

  execFileSync('python3', [transform.pathname, routes, upstreams])

  const changedRoutes = readFileSync(routes, 'utf8')
  const changedUpstreams = readFileSync(upstreams, 'utf8')
  assert.match(changedRoutes, /proxy_pass http:\/\/apigate;/)
  assert.doesNotMatch(changedRoutes, /location \/bio|location \/gql/)
  assert.match(changedRoutes, /^before/m)
  assert.match(changedRoutes, /^after/m)
  assert.match(changedUpstreams, /upstream other \{ server 127\.0\.0\.1:9999; \}/)
  assert.match(changedUpstreams, /server 127\.0\.0\.1:3024;/)
  assert.doesNotMatch(changedUpstreams, /127\.0\.0\.1:3023/)
})

test('production migration refuses an unexpected config instead of guessing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'apigate-nginx-migration-'))
  const routes = join(directory, 'routes.conf')
  const upstreams = join(directory, 'upstreams.conf')
  writeFileSync(routes, 'location /api { proxy_pass https://unexpected; }\n')
  writeFileSync(upstreams, 'upstream apigate { server 127.0.0.1:3023; }\n')

  assert.throws(() => execFileSync('python3', [transform.pathname, routes, upstreams], {
    stdio: 'pipe'
  }))
  assert.equal(readFileSync(routes, 'utf8'), 'location /api { proxy_pass https://unexpected; }\n')
})

test('sudo wrapper includes candidate preflight, validation, smoke tests, and rollback', () => {
  const script = readFileSync(new URL('../scripts/apply-nginx-apigate-tls-off.sh', import.meta.url), 'utf8')
  assert.match(script, /http:\/\/127\.0\.0\.1:3024\/api\/json/)
  assert.match(script, /nginx -t/)
  assert.match(script, /systemctl reload nginx/)
  assert.match(script, /--resolve ecodata\.odb\.ntu\.edu\.tw:443:127\.0\.0\.1/)
  assert.match(script, /_migration_check=\$\{timestamp\}/)
  assert.match(script, /for attempt in \{1\.\.15\}/)
  assert.match(script, /openapi_ready=true/)
  assert.match(script, /restore\(\)/)
  assert.match(script, /routes-vm134\.conf/)
  assert.match(script, /upstreams-vm134\.conf/)
})
