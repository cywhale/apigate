/*
  Read-only metadata capture for apigate on SQL Server 2019.
  Run in the API database. This script does not create or modify objects.
*/
SET NOCOUNT ON;

SELECT
  @@VERSION AS server_version,
  DB_NAME() AS database_name,
  d.compatibility_level,
  d.collation_name,
  d.is_read_committed_snapshot_on,
  d.snapshot_isolation_state_desc
FROM sys.databases AS d
WHERE d.database_id = DB_ID();

DECLARE @procedures TABLE (name sysname PRIMARY KEY);
INSERT INTO @procedures (name) VALUES
  (N'ctdavg'), (N'ctdgridqry'), (N'ctdqry'),
  (N'sadcpavg'), (N'sadcpgridqry'), (N'sadcpqry');

SELECT
  SCHEMA_NAME(p.schema_id) AS schema_name,
  p.name AS procedure_name,
  p.create_date,
  p.modify_date,
  OBJECTPROPERTYEX(p.object_id, 'IsEncrypted') AS is_encrypted
FROM sys.procedures AS p
JOIN @procedures AS wanted ON wanted.name = p.name
ORDER BY schema_name, procedure_name;

SELECT
  SCHEMA_NAME(p.schema_id) AS schema_name,
  p.name AS procedure_name,
  prm.parameter_id,
  prm.name AS parameter_name,
  TYPE_NAME(prm.user_type_id) AS type_name,
  prm.max_length,
  prm.precision,
  prm.scale,
  prm.is_output
FROM sys.procedures AS p
JOIN @procedures AS wanted ON wanted.name = p.name
JOIN sys.parameters AS prm ON prm.object_id = p.object_id
ORDER BY schema_name, procedure_name, prm.parameter_id;

SELECT
  OBJECT_SCHEMA_NAME(d.referencing_id) AS procedure_schema,
  OBJECT_NAME(d.referencing_id) AS procedure_name,
  d.referenced_schema_name,
  d.referenced_entity_name,
  d.is_ambiguous
FROM sys.sql_expression_dependencies AS d
JOIN sys.procedures AS p ON p.object_id = d.referencing_id
JOIN @procedures AS wanted ON wanted.name = p.name
ORDER BY procedure_schema, procedure_name, referenced_schema_name, referenced_entity_name;

;WITH referenced_objects AS (
  SELECT DISTINCT OBJECT_ID(QUOTENAME(d.referenced_schema_name) + N'.' + QUOTENAME(d.referenced_entity_name)) AS object_id
  FROM sys.sql_expression_dependencies AS d
  JOIN sys.procedures AS p ON p.object_id = d.referencing_id
  JOIN @procedures AS wanted ON wanted.name = p.name
  WHERE d.referenced_database_name IS NULL
)
SELECT
  OBJECT_SCHEMA_NAME(o.object_id) AS object_schema,
  o.name AS object_name,
  o.type_desc,
  i.index_id,
  i.name AS index_name,
  i.type_desc AS index_type,
  i.is_unique,
  i.is_disabled,
  i.has_filter,
  i.filter_definition,
  ic.key_ordinal,
  ic.is_included_column,
  c.name AS column_name
FROM referenced_objects AS r
JOIN sys.objects AS o ON o.object_id = r.object_id
LEFT JOIN sys.indexes AS i ON i.object_id = o.object_id
LEFT JOIN sys.index_columns AS ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
LEFT JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE r.object_id IS NOT NULL
ORDER BY object_schema, object_name, i.index_id, ic.key_ordinal, ic.index_column_id;

;WITH referenced_objects AS (
  SELECT DISTINCT OBJECT_ID(QUOTENAME(d.referenced_schema_name) + N'.' + QUOTENAME(d.referenced_entity_name)) AS object_id
  FROM sys.sql_expression_dependencies AS d
  JOIN sys.procedures AS p ON p.object_id = d.referencing_id
  JOIN @procedures AS wanted ON wanted.name = p.name
  WHERE d.referenced_database_name IS NULL
)
SELECT
  OBJECT_SCHEMA_NAME(o.object_id) AS object_schema,
  o.name AS object_name,
  SUM(CASE WHEN ps.index_id IN (0, 1) THEN ps.row_count ELSE 0 END) AS approximate_row_count,
  MAX(STATS_DATE(s.object_id, s.stats_id)) AS newest_statistics_at,
  MIN(STATS_DATE(s.object_id, s.stats_id)) AS oldest_statistics_at
FROM referenced_objects AS r
JOIN sys.objects AS o ON o.object_id = r.object_id
LEFT JOIN sys.dm_db_partition_stats AS ps ON ps.object_id = o.object_id
LEFT JOIN sys.stats AS s ON s.object_id = o.object_id
WHERE r.object_id IS NOT NULL
GROUP BY o.object_id, o.name
ORDER BY object_schema, object_name;

SELECT
  SCHEMA_NAME(v.schema_id) AS view_schema,
  v.name AS view_name,
  m.definition
FROM sys.views AS v
JOIN sys.sql_modules AS m ON m.object_id = v.object_id
WHERE v.name IN (
  N'view_ctd_measured_2015', N'view_ctd_grid15moa_2015', N'view_ctd_grid15moa_yyyymm',
  N'view_sadcp_measured_2015', N'view_sadcp_grid15moa_2015', N'view_sadcp_grid15moa_yyyymm'
)
ORDER BY view_schema, view_name;
