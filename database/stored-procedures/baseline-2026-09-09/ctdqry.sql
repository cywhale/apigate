USE [odbphy]
GO
/****** Object:  StoredProcedure [dbo].[ctdqry]    Script Date: 2026/9/9 上午 09:03:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- Author:		cywhale
-- Create date: 2022/08/18
-- Description:	CTD query
-- =============================================
ALTER PROCEDURE [dbo].[ctdqry] 
	-- Add the parameters for the stored procedure here
	@lon0 float = 105.0, 
	@lon1 float = 135.0,
	@lat0 float = 2.0, 
	@lat1 float = 35.0,
	@dep0 numeric = NULL, 
	@dep1 numeric = NULL,
	@dep_mode nvarchar(10) = NULL, --'range', 'mean', 'exact'
	@mode nvarchar(10) = NULL,
	@cruise nvarchar(10) =  NULL,
	@xorder int = NULL,
    @yorder int = NULL,
	@start nvarchar(10) = '1991-01-01', 
	@end nvarchar(10) = NULL, 
	@limit int = NULL,
	@mean_threshold int = NULL,
	@append varchar(200) = 'temperature' --fluorescence
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    -- Insert statements for procedure here
DECLARE @dt_start DATETIME ;
DECLARE @dt_end DATETIME ;
SET @dt_start = @start

IF @end is NULL
  SET @dt_end = DATEADD(yyyy, -3, DATEADD(dd, 0, DATEADD(mm, DATEDIFF(mm,0,getdate())+1, 0)));
ELSE
  SET @dt_end = COALESCE(@end, DATEADD(yyyy, -3, DATEADD(dd, 0, DATEADD(mm, DATEDIFF(mm,0,getdate())+1, 0))));

IF (@limit is NULL OR @limit <= 0)
  SET @limit = 0

IF @xorder is NULL
  SET @xorder = 0

IF @yorder is NULL
  SET @yorder = 0

IF (@dep0 is not NULL AND @dep0 < 0) --allow js pass -1 as null
  SET @dep0 = NULL

IF (@dep1 is not NULL AND @dep1 < 0)
  SET @dep1 = NULL

IF (@cruise is not NULL AND @cruise = '*')
  SET @cruise = NULL

DECLARE @crfilter nvarchar(60);
IF (@cruise is not NULL)
  BEGIN
	IF (@mode = 'raw')
	  BEGIN
	    SET @crfilter = N''
		SET @append = @append + ',cruise,cast';
      END
    ELSE
	  SET @crfilter = N' AND '

	IF CHARINDEX('*', @cruise) > 0
      SET @crfilter = @crfilter + N'"odb_cruise_id" LIKE ''' + REPLACE(@cruise, '*', '%') + N'''';
    ELSE
	  SET @crfilter = @crfilter + N'"odb_cruise_id" = ''' + @cruise + N'''';  
  END
ELSE
  SET @crfilter = N'';

DECLARE @having nvarchar(40);
IF (@mean_threshold is NULL OR @mean_threshold <= 1)
  SET @having = N''
ELSE
  SET @having = N' HAVING (COUNT(*) >= @mean_threshold)';

DECLARE @depas int
SET @depas = -1; 
DECLARE @deprng nvarchar(40);
SET @deprng = N'';
IF (((@dep0 is NULL AND @dep1 is NULL AND @dep_mode is NULL) OR ISNUMERIC(@dep_mode) = 1) AND @mode != 'raw')
  BEGIN
  IF (ISNUMERIC(@dep_mode) = 1 AND convert(int,@dep_mode) >= 5)
    SET @depas = convert(int,@dep_mode);
  ELSE
    SET @depas = 10; -- default each 10m as a group of range
  END
ELSE IF (ISNUMERIC(@dep_mode) = 1 AND @mode = 'raw')
  SET @dep_mode = NULL

IF (@dep_mode is NULL OR @dep_mode = 'range' OR @dep_mode = 'mean' OR @depas > 0)
  BEGIN
    IF (@dep0 is not NULL AND @dep1 is not NULL)
	  SET @deprng = N' AND pressure BETWEEN @dep0 AND @dep1'
    ELSE IF (@dep0 is not NULL AND @dep1 is NULL)
	  SET @deprng = N' AND pressure >= @dep0'
    ELSE IF (@dep0 is NULL AND @dep1 is not NULL)
	  SET @deprng = N' AND pressure <= @dep1'
  END
ELSE IF (@dep0 is not NULL AND @dep_mode = 'exact')
  SET @deprng = N' AND pressure = @dep0'

DECLARE @colvars nvarchar(MAX);
SET @colvars = N'longitude_degree as longitude, latitude_degree as latitude, -1 as time_period, pressure as "depth", [temperature] as "temperature", [salinity] as "salinity", [density] as "density", [fluorescence] as "fluorescence", [transmission] as "transmission", [oxygen_mm_l] as "oxygen", convert(nchar(19),[GMT+8],126) as "datetime", 1 as "count"';

if (@cruise is not NULL AND @mode = 'raw')
  SET @colvars = @colvars + N', [odb_cruise_id] as "cruise", [RELATED_CAST_NC] as "cast"'

DECLARE @periodqry nvarchar(300);
SET @periodqry = N'';
IF (@mode = 'month')
  BEGIN
    SET @periodqry = N', DATEPART(MM, [GMT+8])';
    IF (@dep_mode = 'mean')
      SET @colvars = N'CAST((longitude_degree-0.125) / 0.25 as int) * 0.25 + 0.25 as longitude, CAST((latitude_degree-0.125) / 0.25  as int) * 0.25 + 0.25 as latitude, DATEPART(MM, [GMT+8]) as time_period, convert(int,AVG(pressure)) as "depth", AVG([temperature]) as "temperature", AVG([salinity]) as "salinity", AVG([density]) as "density", AVG([fluorescence]) as "fluorescence", AVG([transmission]) as "transmission", AVG([oxygen_mm_l]) as "oxygen"';
    ELSE IF (@dep0 is not NULL AND @dep_mode = 'exact')
      SET @colvars = N'CAST((longitude_degree-0.125) / 0.25 as int) * 0.25 + 0.25 as longitude, CAST((latitude_degree-0.125) / 0.25  as int) * 0.25 + 0.25 as latitude, DATEPART(MM, [GMT+8]) as time_period, @dep0 as "depth", AVG([temperature]) as "temperature", AVG([salinity]) as "salinity", AVG([density]) as "density", AVG([fluorescence]) as "fluorescence", AVG([transmission]) as "transmission", AVG([oxygen_mm_l]) as "oxygen"';
    ELSE 
      SET @colvars = N'CAST((longitude_degree-0.125) / 0.25 as int) * 0.25 + 0.25 as longitude, CAST((latitude_degree-0.125) / 0.25  as int) * 0.25 + 0.25 as latitude, DATEPART(MM, [GMT+8]) as time_period, pressure as "depth", AVG([temperature]) as "temperature", AVG([salinity]) as "salinity", AVG([density]) as "density", AVG([fluorescence]) as "fluorescence", AVG([transmission]) as "transmission", AVG([oxygen_mm_l]) as "oxygen"';
  END  
ELSE IF (@mode = 'season')
  BEGIN
    SET @periodqry = N', CASE WHEN DATEPART(MM, [GMT+8]) IN (12,1,2) THEN 13 WHEN DATEPART(MM, [GMT+8]) IN (3,4,5) THEN 14 WHEN DATEPART(MM, [GMT+8]) IN (6,7,8) THEN 15 WHEN DATEPART(MM, [GMT+8]) IN (9,10,11) THEN 16 END'; 
    IF (@dep_mode = 'mean')
      SET @colvars = N'CAST((longitude_degree-0.125) / 0.25 as int) * 0.25 + 0.25 as longitude, CAST((latitude_degree-0.125) / 0.25  as int) * 0.25 + 0.25 as latitude, CASE WHEN DATEPART(MM, [GMT+8]) IN (12,1,2) THEN 13 WHEN DATEPART(MM, [GMT+8]) IN (3,4,5) THEN 14 WHEN DATEPART(MM, [GMT+8]) IN (6,7,8) THEN 15 WHEN DATEPART(MM, [GMT+8]) IN (9,10,11) THEN 16 END as time_period, convert(int,AVG(pressure)) as "depth", AVG([temperature]) as "temperature", AVG([salinity]) as "salinity", AVG([density]) as "density", AVG([fluorescence]) as "fluorescence", AVG([transmission]) as "transmission", AVG([oxygen_mm_l]) as "oxygen"';
    ELSE IF (@dep0 is not NULL AND @dep_mode = 'exact')
      SET @colvars = N'CAST((longitude_degree-0.125) / 0.25 as int) * 0.25 + 0.25 as longitude, CAST((latitude_degree-0.125) / 0.25  as int) * 0.25 + 0.25 as latitude, CASE WHEN DATEPART(MM, [GMT+8]) IN (12,1,2) THEN 13 WHEN DATEPART(MM, [GMT+8]) IN (3,4,5) THEN 14 WHEN DATEPART(MM, [GMT+8]) IN (6,7,8) THEN 15 WHEN DATEPART(MM, [GMT+8]) IN (9,10,11) THEN 16 END as time_period, @dep0 as "depth", AVG([temperature]) as "temperature", AVG([salinity]) as "salinity", AVG([density]) as "density", AVG([fluorescence]) as "fluorescence", AVG([transmission]) as "transmission", AVG([oxygen_mm_l]) as "oxygen"';
    ELSE
      SET @colvars = N'CAST((longitude_degree-0.125) / 0.25 as int) * 0.25 + 0.25 as longitude, CAST((latitude_degree-0.125) / 0.25  as int) * 0.25 + 0.25 as latitude, CASE WHEN DATEPART(MM, [GMT+8]) IN (12,1,2) THEN 13 WHEN DATEPART(MM, [GMT+8]) IN (3,4,5) THEN 14 WHEN DATEPART(MM, [GMT+8]) IN (6,7,8) THEN 15 WHEN DATEPART(MM, [GMT+8]) IN (9,10,11) THEN 16 END as time_period, pressure as "depth", AVG([temperature]) as "temperature", AVG([salinity]) as "salinity", AVG([density]) as "density", AVG([fluorescence]) as "fluorescence", AVG([transmission]) as "transmission", AVG([oxygen_mm_l]) as "oxygen"';
  END
ELSE IF (@mode = 'monsoon')
  BEGIN
    SET @periodqry = N', CASE WHEN DATEPART(MM, [GMT+8]) IN (10,11,12,1,2,3,4) THEN 17 WHEN DATEPART(MM, [GMT+8]) IN (5,6,7,8,9) THEN 18 END'; 
    IF (@dep_mode = 'mean')
      SET @colvars = N'CAST((longitude_degree-0.125) / 0.25 as int) * 0.25 + 0.25 as longitude, CAST((latitude_degree-0.125) / 0.25  as int) * 0.25 + 0.25 as latitude, CASE WHEN DATEPART(MM, [GMT+8]) IN (10,11,12,1,2,3,4) THEN 17 WHEN DATEPART(MM, [GMT+8]) IN (5,6,7,8,9) THEN 18 END as time_period, convert(int,AVG(pressure)) as "depth", AVG([temperature]) as "temperature", AVG([salinity]) as "salinity", AVG([density]) as "density", AVG([fluorescence]) as "fluorescence", AVG([transmission]) as "transmission", AVG([oxygen_mm_l]) as "oxygen"';
    ELSE IF (@dep0 is not NULL AND @dep_mode = 'exact')
      SET @colvars = N'CAST((longitude_degree-0.125) / 0.25 as int) * 0.25 + 0.25 as longitude, CAST((latitude_degree-0.125) / 0.25  as int) * 0.25 + 0.25 as latitude, CASE WHEN DATEPART(MM, [GMT+8]) IN (10,11,12,1,2,3,4) THEN 17 WHEN DATEPART(MM, [GMT+8]) IN (5,6,7,8,9) THEN 18 END as time_period, @dep0 as "depth", AVG([temperature]) as "temperature", AVG([salinity]) as "salinity", AVG([density]) as "density", AVG([fluorescence]) as "fluorescence", AVG([transmission]) as "transmission", AVG([oxygen_mm_l]) as "oxygen"';
    ELSE
      SET @colvars = N'CAST((longitude_degree-0.125) / 0.25 as int) * 0.25 + 0.25 as longitude, CAST((latitude_degree-0.125) / 0.25  as int) * 0.25 + 0.25 as latitude, CASE WHEN DATEPART(MM, [GMT+8]) IN (10,11,12,1,2,3,4) THEN 17 WHEN DATEPART(MM, [GMT+8]) IN (5,6,7,8,9) THEN 18 END as time_period, pressure as "depth", AVG([temperature]) as "temperature", AVG([salinity]) as "salinity", AVG([density]) as "density", AVG([fluorescence]) as "fluorescence", AVG([transmission]) as "transmission", AVG([oxygen_mm_l]) as "oxygen"';
  END
ELSE IF ((@mode is NULL) OR @mode != 'raw') -- mode is yearly mean
  BEGIN
    SET @periodqry = N'';
    IF (@dep_mode = 'mean')
      SET @colvars = N'CAST((longitude_degree-0.125) / 0.25 as int) * 0.25 + 0.25 as longitude, CAST((latitude_degree-0.125) / 0.25  as int) * 0.25 + 0.25 as latitude, 0 as time_period, convert(int,AVG(pressure)) as "depth", AVG([temperature]) as "temperature", AVG([salinity]) as "salinity", AVG([density]) as "density", AVG([fluorescence]) as "fluorescence", AVG([transmission]) as "transmission", AVG([oxygen_mm_l]) as "oxygen"';
    ELSE IF (@dep0 is not NULL AND @dep_mode = 'exact')
      SET @colvars = N'CAST((longitude_degree-0.125) / 0.25 as int) * 0.25 + 0.25 as longitude, CAST((latitude_degree-0.125) / 0.25  as int) * 0.25 + 0.25 as latitude, 0 as time_period, @dep0 as "depth", AVG([temperature]) as "temperature", AVG([salinity]) as "salinity", AVG([density]) as "density", AVG([fluorescence]) as "fluorescence", AVG([transmission]) as "transmission", AVG([oxygen_mm_l]) as "oxygen"';
    ELSE
      SET @colvars = N'CAST((longitude_degree-0.125) / 0.25 as int) * 0.25 + 0.25 as longitude, CAST((latitude_degree-0.125) / 0.25  as int) * 0.25 + 0.25 as latitude, 0 as time_period, pressure as "depth", AVG([temperature]) as "temperature", AVG([salinity]) as "salinity", AVG([density]) as "density", AVG([fluorescence]) as "fluorescence", AVG([transmission]) as "transmission", AVG([oxygen_mm_l]) as "oxygen"';
  END

DECLARE @whereis nvarchar(300);
-- NOTE This longitude/latitude_degree is raw_data not gridded data, so that "Between" will not the same as using dbo.sadcpgridqry and dbo.sadcpavg procedure
IF (@cruise is not NULL AND @mode = 'raw')
  SET @whereis = @crfilter
ELSE
  SET @whereis = N'[GMT+8] BETWEEN @dt_start AND @dt_end AND longitude_degree BETWEEN @lon0 AND @lon1 AND latitude_degree BETWEEN @lat0 AND @lat1' + @deprng + @crfilter;

-- DECLARE @orderis nvarchar(100);
-- SET @orderis = N'[GMT+8],longitude_degree,latitude_degree';

DECLARE @limitis nvarchar(20);
SET @limitis = CASE WHEN @limit <= 0 THEN N'' else N'TOP(@limit) ' END;

DECLARE @sqlcmd nvarchar(MAX);
IF (@mode = 'raw')
  SET @sqlcmd = N'SELECT ' + @limitis + @colvars + ' FROM dbo.VIEW_CTD_MEASURED_2015 WHERE ' + @whereis; --  + ' ORDER BY ' + @orderis;
ELSE --IF (@mode is NULL OR @mode != 'raw')
  BEGIN
  -- Testing having
  SET @colvars = @colvars + ', COUNT(*) as "count" '
  IF (@dep0 is not NULL AND @dep_mode = 'exact') 
    SET @sqlcmd = N'SELECT ' + @limitis + @colvars + ' FROM dbo.VIEW_CTD_MEASURED_2015 WHERE ' + @whereis + ' GROUP BY ' + 'CAST((longitude_degree-0.125) / 0.25 as int), CAST((latitude_degree-0.125) / 0.25  as int)' + @periodqry + @having;
  ELSE IF (@dep_mode = 'mean')
    SET @sqlcmd = N'SELECT ' + @limitis + @colvars + ' FROM dbo.VIEW_CTD_MEASURED_2015 WHERE ' + @whereis + ' GROUP BY ' + 'CAST((longitude_degree-0.125) / 0.25 as int), CAST((latitude_degree-0.125) / 0.25  as int)' + @periodqry + @having;
  ELSE -- IF (@dep_mode = 'range')
    SET @sqlcmd = N'SELECT ' + @limitis + @colvars + ' FROM dbo.VIEW_CTD_MEASURED_2015 WHERE ' + @whereis + ' GROUP BY ' + 'CAST((longitude_degree-0.125) / 0.25 as int), CAST((latitude_degree-0.125) / 0.25  as int) , pressure' + @periodqry + @having;
  END

IF (@mode = 'raw')
  SET @sqlcmd = 'SELECT longitude,latitude,"time_period",depth,' + @append + ',datetime from (' + @sqlcmd + ') a'; -- WHERE 1=1';
ELSE 
  SET @sqlcmd = 'SELECT longitude,latitude,"time_period",depth,' + @append + ' from (' + @sqlcmd + ') a';
-- print @sqlcmd

--IF (((@mode is NULL) OR (@mode != 'raw')) AND (@yorder != 0 OR @xorder != 0))
IF (@yorder != 0 OR @xorder != 0)
  BEGIN
  IF (@yorder > 0 AND ABS(@yorder) > ABS(@xorder))
    BEGIN
	  IF (@xorder > 0)
        SET @sqlcmd = @sqlcmd + ' ORDER BY latitude, longitude'
	  ELSE IF (@xorder < 0)
	    SET @sqlcmd = @sqlcmd + ' ORDER BY latitude, longitude DESC'
      ELSE
	    SET @sqlcmd = @sqlcmd + ' ORDER BY latitude'
	END
  ELSE IF (@yorder < 0 AND ABS(@yorder) > ABS(@xorder))
    BEGIN
	  IF (@xorder > 0)
        SET @sqlcmd = @sqlcmd + ' ORDER BY latitude DESC, longitude'
	  ELSE IF (@xorder < 0)
	    SET @sqlcmd = @sqlcmd + ' ORDER BY latitude DESC, longitude DESC'
      ELSE
	    SET @sqlcmd = @sqlcmd + ' ORDER BY latitude DESC'
	END
  ELSE IF (@xorder > 0 AND ABS(@yorder) <= ABS(@xorder))
    BEGIN
	  IF (@yorder > 0)
        SET @sqlcmd = @sqlcmd + ' ORDER BY longitude, latitude'
	  ELSE IF (@yorder < 0)
	    SET @sqlcmd = @sqlcmd + ' ORDER BY longitude, latitude DESC'
      ELSE
	    SET @sqlcmd = @sqlcmd + ' ORDER BY longitude'
	END
  ELSE IF (@xorder < 0 AND ABS(@yorder) <= ABS(@xorder))
    BEGIN
	  IF (@yorder > 0)
        SET @sqlcmd = @sqlcmd + ' ORDER BY longitude DESC, latitude'
	  ELSE IF (@yorder < 0)
	    SET @sqlcmd = @sqlcmd + ' ORDER BY longitude DESC, latitude DESC'
      ELSE
	    SET @sqlcmd = @sqlcmd + ' ORDER BY longitude DESC'
	END
  END

--SET @sqlcmd = @sqlcmd + ' OFFSET 0 ROWS'
print @sqlcmd;

EXEC sp_executesql @sqlcmd, 
  N'@limit int, @dt_start DATETIME, @dt_end DATETIME, @lon0 float, @lon1 float, @lat0 float, @lat1 float, @dep0 numeric, @dep1 numeric, @mean_threshold int, @cruise nvarchar(10)', 
  @limit = @limit, @dt_start = @dt_start, @dt_end = @dt_end, @lon0 = @lon0, @lon1 = @lon1, @lat0 = @lat0, @lat1 = @lat1, @dep0 = @dep0, @dep1 = @dep1, @mean_threshold = @mean_threshold, @cruise = @cruise;
END
