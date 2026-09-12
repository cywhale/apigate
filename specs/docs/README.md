# Project documentation map

This directory contains durable project guidance and dated review records.

## Start here

1. Read the repository root [AGENTS.md](../../AGENTS.md) for stable engineering, runtime, database, and collaboration rules.
2. Read [security and publication policy](security-and-publication-policy-2026-09.md) before changing or publishing SQL procedure snapshots.
3. Read [production readiness and performance assessment](production-readiness-and-performance-assessment-2026-09.md) for the architecture boundary and known performance risks.
4. Read [database/stored-procedures/README.md](../../database/stored-procedures/README.md) for procedure-to-view mapping and the non-deployment snapshot policy.
5. Use [release-1.7.0-checklist.md](release-1.7.0-checklist.md) as a historical release example; for later releases, derive the version from server/package.json and update the checklist rather than copying its version literally.

## Document status

- Dated assessment and security policy files are review records. They do not authorize SQL Server or production changes.
- SQL procedure files remain the inspectable source snapshots. Security policy is separated from source so an agent can review both the exact SQL and its threat model in one repository.
- A future release may add a newer dated assessment. Do not assume a version number, port, or deployment snapshot in a dated document remains current.
