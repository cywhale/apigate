# SQL source publication and security policy

Status: current policy for the public repository; review when procedure or deployment boundaries change.

## Purpose

This policy explains why the SQL Server procedure snapshots remain in the public repository and how to interpret their security risks. It separates exact source review from threat modelling. It does not authorize executing SQL, changing permissions, or deploying to production.

## Publication decision

The active CTD/SADCP procedure snapshots remain versioned under database/stored-procedures/current so an application developer, reviewer, or AI agent can inspect the exact query, compare it with the API route, and retain a rollback reference.

The baseline directory is historical evidence. Its raw procedures are not public API routes and must remain unreachable from Fastify. Moving these files to a private repository would reduce source visibility for reviewers, but would not remove their existing public Git history or prevent API probing. It would also create synchronization and rollback gaps. Do not split the source into another repository without an explicit repository-governance decision.

Diagnostics SQL is read-only metadata collection. Diagnostics output, actual execution plans, credentials, and deployment backups are not application source and should not be committed unless separately reviewed.

## Threat model

### Credentials and internal metadata

The current SQL snapshots contain database/schema/view names and query semantics, but no known password, token, or connection secret. This is not proof that all Git history is clean. A repository-wide history secret scan remains a release/security task.

Database names, SQL Server version, view names, and procedure parameters are operational metadata. Their publication increases reconnaissance information but does not grant database access. Network isolation, firewall rules, and least-privilege SQL permissions remain the real boundary.

### Dynamic SQL and injection

Dynamic SQL is not automatically exploitable through the public API:

- Scalar values passed through sp_executesql are parameterized in the reviewed procedures.
- Fastify validates numeric/date parameters and filters public append values against an allow-list.
- raw, rawx, and cruise modes are disabled at the public route boundary.

There is still a conditional direct-database risk. Dynamic projection/order identifiers, especially append, are concatenated into procedure SQL. Legacy raw ctdqry also contains cruise-dependent dynamic SQL. A database caller who can execute those procedures and supply untrusted identifier or cruise text could bypass Fastify's allow-list. Procedure-side identifier allow-listing is a future hardening slice.

The procedure's internal `sp_executesql` bindings do not make Fastify's outer `EXEC` string parameterized. The public boundary currently relies on schema validation and allow-list normalization, which is covered by the app-level tests below.

The public Node test suite must test that injection-like HTTP values do not reach the generated EXEC command. It must not claim to prove arbitrary SQL safety inside SQL Server.

### Denial of service

DoS/resource exhaustion is a separate risk from SQL injection. The public API can issue broad or expensive queries, and current risks include full scans on monthly tables, unlimited or large responses, process-local response caches, duplicate in-flight cache misses, and incomplete slow-client backpressure. Publishing SQL makes expensive query patterns easier to understand, but hiding SQL is not a DoS mitigation.

Load, memory, and SQL execution-plan tests require an isolated staging environment. They must not run destructive payloads or uncontrolled concurrency against production.

## Safety rules

- Treat database/stored-procedures/current and baseline as review/rollback snapshots, never as application startup, package-install, or CI migrations.
- Do not commit credentials, certificates, private keys, database result dumps, or production execution-plan files without a separate review.
- Keep raw/cruise procedures unreachable from public Fastify routes.
- When changing procedure-side dynamic SQL, validate identifiers inside SQL Server as well as at the application boundary, then compare representative result sets and actual plans in staging.
- If a secret is found in Git history, rotate/revoke it first. Removing the current file alone does not remove historical exposure.
