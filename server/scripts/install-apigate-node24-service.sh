#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  exec sudo "$0" "$@"
fi

service_name=pm2-apigate-node24.service
unit_source=/home/odbadmin/proj/apigate/server/ops/${service_name}
unit_target=/etc/systemd/system/${service_name}
pm2_home=/home/odbadmin/.pm2-apigate-node24
node=/home/odbadmin/.nvm/versions/v24.20.0/bin/node
pm2=/home/odbadmin/.local/npm/lib/node_modules/pm2/bin/pm2

as_odbadmin() {
  runuser -u odbadmin -- env PM2_HOME="${pm2_home}" "${node}" "${pm2}" "$@"
}

if [ ! -x "${node}" ] || [ ! -f "${pm2}" ]; then
  echo "Pinned Node or PM2 is missing; refusing to install the service." >&2
  exit 1
fi

if ! curl --silent --show-error --fail --max-time 15 \
  http://127.0.0.1:3025/api/json | grep -q '"openapi":"3.1.0"'; then
  echo "The two-worker candidate is not healthy on port 3025; refusing to continue." >&2
  exit 1
fi

worker_count=$(as_odbadmin jlist | "${node}" --input-type=module -e \
  "let s=''; for await (const c of process.stdin) s+=c; const p=JSON.parse(s); console.log(p.filter(x => x.name === 'apigate' && x.pm2_env?.status === 'online' && x.pm2_env?.exec_mode === 'cluster_mode').length)")
if [ "${worker_count}" -ne 2 ]; then
  echo "Expected exactly two online apigate cluster workers; found ${worker_count}." >&2
  exit 1
fi

as_odbadmin save
install -m 0644 "${unit_source}" "${unit_target}"
systemctl daemon-reload
systemctl enable "${service_name}"

# Port 3025 is not serving production yet, so prove resurrection before cutover.
as_odbadmin kill
if ! systemctl start "${service_name}"; then
  echo "systemd start failed; attempting a direct PM2 resurrection." >&2
  as_odbadmin resurrect || true
  exit 1
fi

healthy=false
for attempt in {1..30}; do
  if curl --silent --fail --max-time 5 http://127.0.0.1:3025/api/json \
    | grep -q '"openapi":"3.1.0"'; then
    healthy=true
    break
  fi
  sleep 1
done

if [ "${healthy}" != true ]; then
  echo "Port 3025 did not recover after systemd resurrection." >&2
  systemctl stop "${service_name}" || true
  as_odbadmin resurrect || true
  exit 1
fi

if ! systemctl is-active --quiet "${service_name}"; then
  echo "The service resurrected apigate but is not active." >&2
  exit 1
fi

echo "Installed and verified ${service_name}."
echo "The Node 24 apigate cluster is healthy on http://127.0.0.1:3025."
