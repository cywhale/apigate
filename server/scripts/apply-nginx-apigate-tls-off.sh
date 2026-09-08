#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  exec sudo "$0" "$@"
fi

repo_server=/home/odbadmin/proj/apigate/server
transformer="${repo_server}/scripts/transform-nginx-apigate-tls-off.py"
routes=/etc/nginx/conf2.d/routes-vm134.conf
upstreams=/etc/nginx/conf2.d/upstreams-vm134.conf
backup_base=/home/odbadmin/backup/conf/nginx-migration
timestamp=$(date +%Y%m%d-%H%M%S)
backup="${backup_base}/apigate-tls-off-${timestamp}"

if [ ! -x /home/odbadmin/.nvm/versions/v24.20.0/bin/node ]; then
  echo "Node 24.20.0 is missing; refusing to switch NGINX." >&2
  exit 1
fi

candidate_json=$(curl --silent --show-error --fail --max-time 15 \
  http://127.0.0.1:3024/api/json) || {
  echo "apigate-next is not healthy on http://127.0.0.1:3024; refusing to switch." >&2
  exit 1
}

if ! printf '%s' "${candidate_json}" | grep -q '"openapi":"3.1.0"'; then
  echo "Candidate did not publish OpenAPI 3.1.0; refusing to switch." >&2
  exit 1
fi

mkdir -p "${backup}/conf2.d"
cp "${routes}" "${backup}/conf2.d/routes-vm134.conf"
cp "${upstreams}" "${backup}/conf2.d/upstreams-vm134.conf"

restore() {
  echo "Restoring previous NGINX config from ${backup}" >&2
  cp "${backup}/conf2.d/routes-vm134.conf" "${routes}"
  cp "${backup}/conf2.d/upstreams-vm134.conf" "${upstreams}"
  nginx -t || true
  systemctl reload nginx || true
}

if ! python3 "${transformer}" "${routes}" "${upstreams}"; then
  restore
  exit 1
fi

if ! nginx -t; then
  restore
  exit 1
fi

if ! systemctl reload nginx; then
  restore
  exit 1
fi

if ! systemctl is-active --quiet nginx; then
  restore
  exit 1
fi

if ! curl --silent --show-error --fail --max-time 20 \
  --resolve ecodata.odb.ntu.edu.tw:443:127.0.0.1 \
  "https://ecodata.odb.ntu.edu.tw/api/json?_migration_check=${timestamp}" \
  | grep -q '"openapi":"3.1.0"'; then
  echo "HTTPS OpenAPI smoke test failed after reload." >&2
  restore
  exit 1
fi

if ! curl --silent --show-error --fail --max-time 60 \
  --resolve ecodata.odb.ntu.edu.tw:443:127.0.0.1 \
  "https://ecodata.odb.ntu.edu.tw/api/ctd?lon0=120&lon1=121&lat0=20&lat1=21&dep0=100&limit=1&_migration_check=${timestamp}" \
  | grep -q '^\['; then
  echo "HTTPS CTD smoke test failed after reload." >&2
  restore
  exit 1
fi

echo "Applied apigate TLS-off NGINX migration successfully."
echo "Backup: ${backup}"
echo "Rollback remains available by restoring the two files in that directory."
