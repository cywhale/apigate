# AGENTS.md — apigate

## Read first

Before changing code, read README.md, this file, specs/docs/README.md, the current dated assessment, database/README.md, database/stored-procedures/README.md, and the relevant tests under server/tests.

## Project contract

- Production consumers depend on `GET /api/ctd` and `GET /api/sadcp`. Preserve their parameter names, defaults, response bytes/shapes, ordering assumptions, and error behavior unless a consumer-specific change has been discussed first.
- OAS must remain OpenAPI 3.1.0. Keep servers[0].url as the bare public authority https://ecodata.odb.ntu.edu.tw and keep paths /api/ctd and /api/sadcp; treat external consumer identity as a compatibility contract and do not change it without consumer review.
- JSON is an array, GeoJSON is a FeatureCollection, and SADCP `uvgrid` is `{header, data}`. A schema correction must not silently change wire output.
- Numeric `dep_mode` is CTD-only depth-bin behavior. SADCP accepts only `mean`, `exact`, and `range`. Keep raw/rawx and cruise unreachable from public requests; legacy code may remain behind an explicit disabled guard.
- `/bio` and `/gql` are retired. Do not reintroduce them or their dependencies without a new decision.

## Runtime and deployment

- In an interactive shell, use nvm use 24.20.0 (or the version in .nvmrc) for manual commands and tests.
- At boot, systemd does not source nvm: pm2-apigate-node24.service uses the absolute Node 24 binary and PM2_HOME. If the Node major changes, update and test the unit/install script rather than assuming an interactive nvm selection.
- Production runs PM2 under the dedicated `pm2-apigate-node24.service`; NGINX terminates TLS and proxies localhost HTTP. Do not use production ports for local tests.
- The current production upstream is `127.0.0.1:3025`; ports `3024` and `3023` are reserved rollback/candidate ports. Do not bind them for local tests.
- NGINX/systemd changes require privileged operations. Prepare or review the existing scripts under `server/scripts/`; a maintainer executes sudo commands and keeps the generated backup/rollback location.
- Never commit credentials, `.env`, certificates, private keys, or test secrets.

## Database boundary

- SQL Server is version `15.0.2000.5`, database `odbphy`. The procedure snapshots under `database/stored-procedures/` are review/rollback evidence, not migrations.
- Public procedures map to `dbo.VIEW_CTD_GRID15MOA_2015`, `dbo.VIEW_CTD_GRID15MOA_yyyymm`, `dbo.VIEW_SADCP_GRID15MOA_2015`, and `dbo.VIEW_SADCP_GRID15MOA_yyyymm`; measured views are raw/source orientation tables.
- The legacy raw `sadcpqry.sql` snapshot references `dbo.VIEW_SADCP_10M_2015`; diagnostics also inventories `dbo.VIEW_SADCP_MEASURED_2015` separately. Do not substitute one for the other.
- Never execute stored procedure files from application startup, package install, CI, or an unreviewed agent session. DB deployment belongs to the table/procedure maintainer and must be staged or backed up first.
- Read `database/stored-procedures/README.md` before interpreting procedure names, view/table names, `year/month` data, or `time_period`. Preserve the known distinction between `*_2015` all-span procedures and `*_yyyymm` date-range procedures.
- Query aggregation/filtering belongs in SQL Server; public validation, response formatting, cache, HTTP stream, and backpressure belong in Fastify. Do not move millions of rows to Node merely to avoid a database plan issue.

## Testing requirements

- Every implementation slice must add or update a focused test under `server/tests/`. Tests must cover compatibility and failure cases, not just source-text presence.
- Before handoff, run `cd server && nvm use 24.20.0 && pnpm test`, then report the exact result.
- SQL tests that inspect files do not prove SQL Server execution. For procedure changes retain the SQL Server diagnostic/result/actual-plan evidence separately and document the database version/compatibility level.
- For stream, cache, or response changes include large-result, SQL-error, client-abort/slow-client, and cache hit/miss considerations where relevant.

## Collaboration and release

- Work on a new branch for material changes. Keep code developer and code reviewer roles separate; reviewer must inspect the diff and test output before merge.
- Prefer small slices and atomic commits. Do not mix SQL production deployment with application merge.
- For each release, read the current version from server/package.json and create the matching annotated tag only after merge to main, final tests, production smoke tests, and rollback evidence. Do not hard-code a previous release version here.
- Do not force-push, reset, or discard user changes. Ask before resolving an overlapping dirty worktree.

## Upgrade notes

- Fastify and its @fastify plugins must remain on compatible major versions; preserve the OpenAPI 3.1 identity and verify reply/stream lifecycle behavior after upgrades.
- Knex 3 and Tedious 20 must retain MSSQL raw-query compilation and streaming behavior. Pool, timeout, encryption, and multiple-statements changes require isolated SQL staging; Node unit tests do not prove database compatibility.
- lru-cache 11 uses the named LRUCache export. Its max option counts entries, not bytes, and the cache is process-local per PM2 worker. Do not treat it as a memory budget or shared cache.
- The pnpm lockfile is version 6 and does not store the package version importer metadata; a package-only release version bump does not require a lockfile rewrite.

## Known risks to keep visible

- Response cache currently has no byte budget and is duplicated per PM2 worker; concurrent identical cache misses are not coalesced.
- Raw response writes need careful backpressure handling for slow clients.
- Monthly grid procedures currently have non-SARGable date expressions and production heap/index/statistics work remains with the DB maintainer.
- Dynamic SQL/procedure parameter construction and deterministic ordering are compatibility-sensitive; change one concern at a time and preserve representative result sets.
