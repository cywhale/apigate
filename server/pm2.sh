#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Compatibility entrypoint: defaults to a read-only check of the dedicated service.
# See specs/docs/runtime-maintenance.md before explicitly requesting --apply.
exec "$SCRIPT_DIR/scripts/upgrade-apigate-runtime.sh" "$@"
