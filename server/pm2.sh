#!/usr/bin/env bash
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "nvm is required at $NVM_DIR/nvm.sh" >&2
  exit 1
fi
. "$NVM_DIR/nvm.sh"
nvm use --silent "$SCRIPT_DIR/../.nvmrc"

echo "#---------------------APIGATE Start at $(date '+%Y%m%d %H:%M:%S')"
NODE_OPTIONS=--max_old_space_size=8192 NODE_ENV=production PORT=3023 exec pm2 -n apigate start -i 2 src/index.mjs

