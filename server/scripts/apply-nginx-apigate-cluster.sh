#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  exec sudo "$0" "$@"
fi

repo_server=/home/odbadmin/proj/apigate/server
transformer="${repo_server}/scripts/transform-nginx-apigate-cluster.py"
upstreams=/etc/nginx/conf2.d/upstreams-vm134.conf
backup_base=/home/odbadmin/backup/conf/nginx-migration
timestamp=$(date +%Y%m%d-%H%M%S)
backup="${backup_base}/apigate-node24-cluster-${timestamp}"
service_name=pm2-apigate-node24.service

if ! systemctl is-enabled --quiet "${service_name}" \
  || ! systemctl is-active --quiet "${service_name}"; then
  echo "${service_name} must be enabled and active; refusing to switch." >&2
  exit 1
fi

if ! curl --silent --show-error --fail --max-time 15 \
  http://127.0.0.1:3025/api/json | grep -q '"openapi":"3.1.0"'; then
  echo "The Node 24 cluster is not healthy on port 3025; refusing to switch." >&2
  exit 1
fi

mkdir -p "${backup}/conf2.d"
cp "${upstreams}" "${backup}/conf2.d/upstreams-vm134.conf"

restore() {
  echo "Restoring previous NGINX upstream from ${backup}" >&2
  cp "${backup}/conf2.d/upstreams-vm134.conf" "${upstreams}"
  nginx -t || true
  systemctl reload nginx || true
}

if ! python3 "${transformer}" "${upstreams}"; then
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

openapi_ready=false
for attempt in {1..15}; do
  if curl --silent --fail --max-time 5 \
    --resolve ecodata.odb.ntu.edu.tw:443:127.0.0.1 \
    "https://ecodata.odb.ntu.edu.tw/api/json?_cluster_cutover=${timestamp}-${attempt}" \
    | grep -q '"openapi":"3.1.0"'; then
    openapi_ready=true
    break
  fi
  sleep 1
done

if [ "${openapi_ready}" != true ]; then
  echo "HTTPS OpenAPI smoke test failed after cluster cutover." >&2
  restore
  exit 1
fi

if ! curl --silent --show-error --fail --max-time 60 \
  --resolve ecodata.odb.ntu.edu.tw:443:127.0.0.1 \
  "https://ecodata.odb.ntu.edu.tw/api/ctd?lon0=120&lon1=121&lat0=20&lat1=21&dep0=100&limit=1&_cluster_cutover=${timestamp}" \
  | grep -q '^\['; then
  echo "HTTPS CTD smoke test failed after cluster cutover." >&2
  restore
  exit 1
fi

echo "Switched apigate NGINX upstream to the Node 24 cluster on port 3025."
echo "Backup: ${backup}"
echo "Ports 3024 and 3023 remain running as rollback options."
