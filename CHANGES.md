# Changes

## 1.7.1 — release candidate

- Added a public-source security policy separating exact stored-procedure review from dynamic-SQL, direct-database, and DoS risk guidance.
- Added app-level append boundary tests for injection-like values without connecting to SQL Server.
- Clarified version-independent agent handoff rules, interactive nvm use, fixed Node 24 systemd/PM2 startup, and upgrade caveats for Fastify, Knex, Tedious, and lru-cache.
- No production API wire behavior or stored procedure was changed in this slice.

## 1.7.0 — release candidate

- Compatibility note: Node 24 is required and the deprecated `/bio` and `/gql` endpoints are unavailable; the production CTD/SADCP paths and wire shapes remain compatible.
- Upgraded the Fastify/OpenAPI stack and published the API document as OpenAPI 3.1.0 while preserving the CTD/SADCP production paths and consumer identity.
- Standardized the Node 24.20.0 runtime and isolated PM2/NGINX TLS-off production deployment path.
- Retired public Bio/GraphQL routes and kept raw/rawx/cruise behavior unreachable.
- Fixed and regression-tested date validation, `mean_threshold`, CTD/SADCP depth-mode handling, ordered limits, default UV-grid period serialization, and SQL stream completion/error handling.
- Versioned the SQL Server procedure snapshots, diagnostics, execution-plan review notes, and database deployment boundary.
- Added release, performance, and AI-agent handoff documentation; every future implementation slice must include focused tests under `server/tests/`.

## Earlier releases

Earlier release history is preserved by the existing Git tags. Detailed historical changes remain in Git commit history; this changelog starts with the 1.7.0 modernization release.
