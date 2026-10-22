const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const version = readFileSync(resolve(__dirname, '../../.nvmrc'), 'utf8').trim()
if (!/^24\.\d+\.\d+$/.test(version)) throw new Error('Expected an exact Node 24 version in .nvmrc')

// Production has one stable directory, port and dedicated PM2 home (see systemd).
// Do not use this production configuration to start an isolated staging process.
module.exports = {
  apps: [{
    name: 'apigate',
    cwd: '/home/odbadmin/proj/apigate/server',
    script: 'src/index.mjs',
    interpreter: `/home/odbadmin/.nvm/versions/v${version}/bin/node`,
    instances: 2,
    exec_mode: 'cluster',
    watch: false,
    node_args: [],
    env: { NODE_ENV: 'production', NODE_OPTIONS: '--max_old_space_size=8192', PORT: '3025', APIGATE_TLS: 'false' }
  }]
}
