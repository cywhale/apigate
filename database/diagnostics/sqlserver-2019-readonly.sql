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

DECLARE @views TABLE (
  view_name sysname PRIMARY KEY,
  object_id int NULL
);
INSERT INTO @views (view_name, object_id) VALUES
  (N'VIEW_CTD_GRID15MOA_2015', OBJECT_ID(N'dbo.VIEW_CTD_GRID15MOA_2015', N'V')),
  (N'VIEW_CTD_GRID15MOA_yyyymm', OBJECT_ID(N'dbo.VIEW_CTD_GRID15MOA_yyyymm', N'V')),
  (N'VIEW_CTD_MEASURED_2015', OBJECT_ID(N'dbo.VIEW_CTD_MEASURED_2015', N'V')),
  (N'VIEW_SADCP_GRID15MOA_2015', OBJECT_ID(N'dbo.VIEW_SADCP_GRID15MOA_2015', N'V')),
  (N'VIEW_SADCP_GRID15MOA_yyyymm', OBJECT_ID(N'dbo.VIEW_SADCP_GRID15MOA_yyyymm', N'V')),
  (N'VIEW_SADCP_MEASURED_2015', OBJECT_ID(N'dbo.VIEW_SADCP_MEASURED_2015', N'V'));

-- A NULL object_id means the script is running in the wrong database or the
-- caller cannot see that object. All six rows should be FOUND in odbphy.
SELECT
  DB_NAME() AS database_name,
  N'dbo' AS expected_schema,
  view_name,
  CASE WHEN object_id IS NULL THEN N'MISSING OR NOT VISIBLE' ELSE N'FOUND' END AS status,
  object_id
FROM @views
ORDER BY view_name;

SELECT
  SCHEMA_NAME(v.schema_id) AS view_schema,
  v.name AS view_name,
  m.definition
FROM @views AS wanted
JOIN sys.views AS v ON v.object_id = wanted.object_id
JOIN sys.sql_modules AS m ON m.object_id = v.object_id
ORDER BY view_schema, view_name;

-- Procedure references are assembled as dynamic SQL, so SQL Server cannot
-- expose them through sys.sql_expression_dependencies. Start from the six
-- known views and recursively collect their statically declared dependencies.
DECLARE @objects TABLE (
  source_view sysname NOT NULL,
  object_id int NOT NULL,
  depth int NOT NULL,
  PRIMARY KEY (source_view, object_id)
);

INSERT INTO @objects (source_view, object_id, depth)
SELECT view_name, object_id, 0
FROM @views
WHERE object_id IS NOT NULL;

DECLARE @inserted int = 1;
WHILE @inserted > 0
BEGIN
  INSERT INTO @objects (source_view, object_id, depth)
  SELECT
    parent.source_view,
    dependency.referenced_id,
    MIN(parent.depth) + 1
  FROM @objects AS parent
  JOIN sys.sql_expression_dependencies AS dependency
    ON dependency.referencing_id = parent.object_id
  WHERE dependency.referenced_id IS NOT NULL
    AND dependency.referenced_database_name IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM @objects AS existing
      WHERE existing.source_view = parent.source_view
        AND existing.object_id = dependency.referenced_id
    )
  GROUP BY parent.source_view, dependency.referenced_id;

  SET @inserted = @@ROWCOUNT;
END;

SELECT
  objects.source_view,
  objects.depth,
  OBJECT_SCHEMA_NAME(objects.object_id) AS object_schema,
  OBJECT_NAME(objects.object_id) AS object_name,
  catalog.type_desc,
  synonym.base_object_name
FROM @objects AS objects
JOIN sys.objects AS catalog ON catalog.object_id = objects.object_id
LEFT JOIN sys.synonyms AS synonym ON synonym.object_id = objects.object_id
ORDER BY objects.source_view, objects.depth, object_schema, object_name;

SELECT
  objects.source_view,
  objects.depth,
  OBJECT_SCHEMA_NAME(catalog.object_id) AS object_schema,
  catalog.name AS object_name,
  catalog.type_desc AS object_type,
  indexes.index_id,
  indexes.name AS index_name,
  indexes.type_desc AS index_type,
  indexes.is_unique,
  indexes.is_disabled,
  indexes.has_filter,
  indexes.filter_definition,
  index_columns.key_ordinal,
  index_columns.is_included_column,
  columns.name AS column_name
FROM @objects AS objects
JOIN sys.objects AS catalog ON catalog.object_id = objects.object_id
LEFT JOIN sys.indexes AS indexes ON indexes.object_id = catalog.object_id
LEFT JOIN sys.index_columns AS index_columns
  ON index_columns.object_id = indexes.object_id
  AND index_columns.index_id = indexes.index_id
LEFT JOIN sys.columns AS columns
  ON columns.object_id = index_columns.object_id
  AND columns.column_id = index_columns.column_id
ORDER BY
  objects.source_view,
  objects.depth,
  object_schema,
  object_name,
  indexes.index_id,
  index_columns.key_ordinal,
  index_columns.index_column_id;

;WITH unique_objects AS (
  SELECT DISTINCT object_id
  FROM @objects
),
row_counts AS (
  SELECT
    partitions.object_id,
    SUM(CASE WHEN partitions.index_id IN (0, 1)
      THEN partitions.row_count ELSE 0 END) AS approximate_row_count
  FROM sys.dm_db_partition_stats AS partitions
  JOIN unique_objects ON unique_objects.object_id = partitions.object_id
  GROUP BY partitions.object_id
),
statistics_dates AS (
  SELECT
    statistics.object_id,
    MAX(STATS_DATE(statistics.object_id, statistics.stats_id)) AS newest_statistics_at,
    MIN(STATS_DATE(statistics.object_id, statistics.stats_id)) AS oldest_statistics_at
  FROM sys.stats AS statistics
  JOIN unique_objects ON unique_objects.object_id = statistics.object_id
  GROUP BY statistics.object_id
)
SELECT
  OBJECT_SCHEMA_NAME(catalog.object_id) AS object_schema,
  catalog.name AS object_name,
  catalog.type_desc,
  row_counts.approximate_row_count,
  statistics_dates.newest_statistics_at,
  statistics_dates.oldest_statistics_at
FROM unique_objects
JOIN sys.objects AS catalog ON catalog.object_id = unique_objects.object_id
LEFT JOIN row_counts ON row_counts.object_id = catalog.object_id
LEFT JOIN statistics_dates ON statistics_dates.object_id = catalog.object_id
ORDER BY object_schema, object_name;

SELECT
  HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'VIEW DEFINITION') AS can_view_definition,
  HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'VIEW DATABASE STATE') AS can_view_database_state;
