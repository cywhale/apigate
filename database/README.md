# SQL Server assets

This directory keeps the database side of the API reviewable without coupling database deployment to the Node.js release.

- `stored-procedures/baseline-2026-09-09/` is an exact, UTF-8/LF transcription of the production-side snapshots supplied on 2026-09-09. It contains known defects and is **not** an automatic deployment source.
- `diagnostics/sqlserver-2019-readonly.sql` is a read-only collector for the metadata needed to review views, indexes, statistics, and compatibility. It performs no writes.
- `review-2026-09-10.md` records the static review and the tests still required on SQL Server.

Database changes must be reviewed and deployed independently. Do not execute stored-procedure files from application startup or CI. Before changing production, capture the diagnostic output, deploy to a staging database or a transactionally controlled test copy, compare representative result sets and execution plans, and keep the previous procedure definitions as rollback artifacts.
