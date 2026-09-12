# Stored procedure map

These files document the database side of the public CTD/SADCP API. They are versioned review snapshots only; they are not deployment migrations.
Read the [security and publication policy](../../specs/docs/security-and-publication-policy-2026-09.md) before changing or publishing procedure snapshots.

## Database and table mapping

Production SQL Server is `15.0.2000.5`, database `odbphy`.

| API path/query route | Procedure | Source view/table | Role |
|---|---|---|---|
| CTD without `start`/`end` | `dbo.ctdavg` | `dbo.VIEW_CTD_GRID15MOA_2015` | all-span/pre-aggregated CTD field |
| CTD with `start` or `end` | `dbo.ctdgridqry` | `dbo.VIEW_CTD_GRID15MOA_yyyymm` | time-aware pre-aggregated CTD field |
| SADCP without `start`/`end` | `dbo.sadcpavg` | `dbo.VIEW_SADCP_GRID15MOA_2015` | all-span/pre-aggregated SADCP field |
| SADCP with `start` or `end` | `dbo.sadcpgridqry` | `dbo.VIEW_SADCP_GRID15MOA_yyyymm` | time-aware pre-aggregated SADCP field |
| legacy raw route (not public) | `dbo.ctdqry`, `dbo.sadcpqry` | `dbo.VIEW_CTD_MEASURED_2015`, `dbo.VIEW_SADCP_10M_2015` | retained baseline reference; unreachable from public API |

The measured views (`VIEW_CTD_MEASURED_2015` and `VIEW_SADCP_10M_2015`) are source/orientation data for the legacy raw snapshots, not the normal public query target. The diagnostics script also inventories `VIEW_SADCP_MEASURED_2015` as a separate object; do not assume it is the raw procedure source. `*_yyyymm` retains year/month dimensions; `*_2015` is the all-span pre-aggregated route.

## API-to-procedure behavior

- No `start`/`end` selects the `*avg` procedure. Supplying either date selects the `*gridqry` procedure.
- CTD numeric `dep_mode` values are depth-bin sizes (values below the accepted threshold fall back to the established default); SADCP numeric `dep_mode` is rejected by the Fastify contract and is not a supported procedure input for public use.
- `mean_threshold` is applied to aggregate counts in grouped mean/depth-bin branches and to row counts in non-grouped branches, according to each procedure's existing logic.
- `mode` selects the established `time_period`/period mapping. Do not infer numeric `time_period` semantics from the API alone; compare the procedure and APIverse consumer contract.
- Dynamic `append` projection is currently constrained by Fastify's public allow-list. A direct database caller can bypass that application guard, so procedure-side identifier validation remains a future hardening item.

## Security classification

- The current CTD/SADCP procedures are public review snapshots because application developers and AI reviewers need to inspect the exact SQL. They are not migrations.
- Dynamic projection/order identifiers such as append are constrained by Fastify but remain a conditional risk for direct database callers; procedure-side allow-listing is a future hardening slice.
- Legacy ctdqry and sadcpqry are historical raw references and must remain unreachable from public routes. Their dynamic cruise/append behavior must not be treated as safe for untrusted database input.
- SQL injection boundary tests belong in the Node suite only at the generated-EXEC boundary. Actual procedure security and execution-plan/load tests require an isolated SQL Server staging environment.
- DoS/resource risks are documented separately from injection: broad scans, unlimited responses, cache duplication, duplicate in-flight queries, and slow-client backpressure require API/DB performance slices.

## Snapshot policy

- `baseline-2026-09-09/` contains the supplied baseline, including known defects; it is useful for review and regression comparison.
- `current/` contains the procedure definitions exported after the 2026-09-11 fixes. It records what was observed/deployed; it does not cause deployment.
- `database/diagnostics/sqlserver-2019-readonly.sql` is read-only metadata collection. Keep its output, representative result sets, and actual execution plans with any DB performance review.
- Before a DB maintainer changes a production procedure: save the current definition, use a staging/copy or a candidate procedure name, compare representative results and plans, and keep an explicit rollback definition.

## Known DB-side risks

- The monthly procedures currently convert `[year]`/`[month]` into a date expression per row, which can prevent an index seek; CTD and SADCP monthly plans have shown heap scans. Index/statistics/table changes require the table maintainer.
- SQL Server server version alone does not establish compatibility. Database compatibility level, view definitions, row counts, statistics freshness, and actual plans must be captured before optimization.
- Averaging pre-aggregated means without `data_no` weighting is a scientific-definition decision, not an implementation assumption.
