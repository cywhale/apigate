# Runtime maintenance

Production uses the original `/home/odbadmin/proj/apigate/server` checkout, HTTP port `3025`, two cluster workers, `PM2_HOME=/home/odbadmin/.pm2-apigate-node24`, and `pm2-apigate-node24.service`. NGINX terminates TLS. Future Node patch updates keep these locations and port fixed.

`.nvmrc` is the runtime version source; `server/ops/ecosystem.config.cjs` defines the production application. Interactive `nvm use` selects the shell runtime only. systemd and saved PM2 worker interpreters must both be updated to absolute paths. Dependencies remain locked during a runtime-only security update.

## Before production

Use an isolated worktree for implementation and staging, with an unused loopback test port and its own process environment. Do not run dependency installs or switch branches in the live production checkout. Test the pinned runtime, actual SQL connectivity, CTD/SADCP, monthly queries, JSON/GeoJSON/uvgrid, and stream/error behavior. Retain test results, the old commit, lockfile, Node binary, unit and PM2 dump. Merge/review first; deploy the reviewed commit into the production checkout during an agreed maintenance window.

The runtime updater does not install Node, change NGINX, deploy SQL or copy application code. A maintainer installs the exact `.nvmrc` version with nvm beforehand. It requires PM2, curl, systemd and the existing dedicated service. It intentionally refuses mixed applications, changed ports/cwd, stale interpreters, stopped workers, service overrides, missing binaries, or a mismatch with the checked-in production configuration.

## Maintainer commands

From the deployed production checkout after merge:

```bash
cd /home/odbadmin/proj/apigate
nvm install "$(tr -d '\r\n' < .nvmrc)"
bash server/scripts/upgrade-apigate-runtime.sh --check
```

The default and `--check` perform preflight only; they do not save PM2 state, stop processes, write backups or change services. Run as `odbadmin`; if host restrictions prevent reading `/proc` or service state, run the same check with sudo. Existing daemon presence is checked before `pm2 jlist` so a missing daemon causes refusal rather than starting a fresh one.

For the maintenance restart:

```bash
sudo bash /home/odbadmin/proj/apigate/server/scripts/upgrade-apigate-runtime.sh --apply
```

Expect a brief interruption while the dedicated service is stopped and resurrected. This is not a zero-downtime deployment. The updater preserves every saved worker environment value except interpreter/PATH; it does not rebuild credentials from a new shell. It backs up the old unit and dump first, stops the old service with its original executable, installs transformed configuration, reloads systemd and starts the same service on `3025`. It verifies OAS, bounded CTD/SADCP queries, live daemon/worker executable paths and service enabled/active state before saving and validating the new PM2 dump.

Afterward verify public HTTPS requests and capture the output privately as release evidence. Reboot validation can be performed in a separate agreed window; a healthy service and dump are not proof of an actual reboot test.

## Rollback and private artifacts

The updater prints an exact rollback command and backup directory under `/home/odbadmin/backup/conf/apigate-runtime/upgrade-*`. The directory is root-owned mode `0700`; its files are mode `0600`. A PM2 dump includes database credentials and other environment values. Never commit, attach to a public issue, or print it into CI logs. Keep the previous Node binary installed until the rollback retention period ends.

On any failure after service-stop begins, the updater attempts automatic restoration of the old unit/dump, starts the previous service, and verifies the previous runtime and local API health. A failed automatic rollback requires operator action using the printed command:

```bash
sudo bash /home/odbadmin/proj/apigate/server/scripts/upgrade-apigate-runtime.sh --rollback /home/odbadmin/backup/conf/apigate-runtime/upgrade-EXACT_BACKUP
```

Supply the actual printed path. Explicit rollback is also a maintenance restart. If the updater is killed abruptly, its exclusive directory lock `/run/lock/apigate-runtime-upgrade` can remain. Inspect the updater/service state and confirm no updater is running before a maintainer removes that one empty lock directory and retries. A normal failure releases the lock automatically. The backup restores runtime/service state, not changes to application source or dependencies made independently; those require their own reviewed rollback.

## Historical deployments and retirement

Do not rerun `install-apigate-node24-service.sh`, `apply-nginx-apigate-tls-off.sh` or `apply-nginx-apigate-cluster.sh` for future runtime updates. They document historical migration assumptions, including ports which were candidates at that time. Keep them for audit/rollback review.

After the new runtime is stable, retire only the obsolete apigate entries on `3023` as a separate operation, run as `odbadmin` (not sudo):

```bash
bash /home/odbadmin/proj/apigate/server/scripts/retire-legacy-apigate-pm2.sh --check
bash /home/odbadmin/proj/apigate/server/scripts/retire-legacy-apigate-pm2.sh --apply
```

The helper checks both PM2 daemons before querying them (so preflight will not start a missing daemon), verifies the Node 24 production health, and targets only matching legacy apigate workers. It removes only their saved entries and deliberately does not run `pm2 save`, preserving unrelated saved application fields/values; it verifies the unrelated live process identities remain unchanged. Avoid concurrent default-PM2 changes or `pm2 save` while it runs because all default applications share one dump file. The private pre-change dump backup is under `/home/odbadmin/backup/apigate-runtime/legacy-pm2`, separate from the root-only runtime-upgrade backup tree; it contains environment values and must stay private (directory mode `0700`, dump mode `0600`). If an operation stops partway, it intentionally does not run `pm2 resurrect` on the default PM2 home, since that could affect unrelated applications; the cleanup is safe to inspect and retry, including when zero or one matching legacy worker remains. The public Node 24 cluster on `3025` is independent and remains the production service. The old entry shares the production source directory and is not an independent code rollback. Port `3024` has no role in this runtime update. Future staging instances should use an isolated checkout and be retired after verification rather than accumulating alternate long-lived production ports.

## Test scope

`server/tests/runtime-upgrade.test.mjs` exercises production-boundary rejection, credential-preserving dump transformation, unit rewriting, check/apply ordering, and automatic rollback paths with fake adapters. These tests do not stop/start systemd, run PM2, connect to SQL Server or prove a reboot. The maintainer's real `--check`, `--apply`, health verification and retained private backup complete that operational evidence.
