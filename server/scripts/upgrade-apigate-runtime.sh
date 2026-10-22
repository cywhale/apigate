#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
version="$(tr -d '\r\n' < "$script_dir/../../.nvmrc")"
if [[ ! "$version" =~ ^24\.[0-9]+\.[0-9]+$ ]]; then
  echo 'Expected an exact Node 24 version in .nvmrc.' >&2
  exit 1
fi
node="/home/odbadmin/.nvm/versions/v${version}/bin/node"
if [[ ! -x "$node" ]]; then
  echo "Install the pinned runtime with nvm first: $version" >&2
  exit 1
fi
exec "$node" "$script_dir/upgrade-apigate-runtime.mjs" "$@"
