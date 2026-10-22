#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
node=/usr/bin/node
if [[ ! -x "$node" ]]; then
  echo 'The legacy PM2 runtime /usr/bin/node is unavailable; refusing to change its process list.' >&2
  exit 1
fi
exec "$node" "$script_dir/retire-legacy-apigate-pm2.mjs" "$@"
