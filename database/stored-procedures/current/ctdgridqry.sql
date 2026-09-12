USE [odbphy]
GO
/****** Object:  StoredProcedure [dbo].[ctdgridqry]    Script Date: 2026/9/11 下午 03:02:22 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- Author:		cywhale
-- Create date: 2022/08/16
-- Description:	CTD (_yyyymm, gridded) query
-- =============================================
ALTER PROCEDURE [dbo].[ctdgridqry] 
	-- Add the parameters for the stored procedure here
	@lon0 float = 105.0,
	@lon1 float = 135.0,
	@lat0 float = 2.0,
	@lat1 float = 35.0,
	@dep0 numeric = NULL, 
	@dep1 numeric = NULL,
	@dep_mode nvarchar(10) = NULL, --'range', 'mean', 'exact'
	@mode nvarchar(10) = NULL,
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
DECLARE @dt_start DATETIME;
DECLARE @dt_end DATETIME;
--DECLARE @day1 int = 1;
DECLARE @yr_start int = 1991;
DECLARE @yr_end int = year(getdate())-3;
DECLARE @mo_start int = 1; 
DECLARE @mo_end int = 12;
SET @yr_start = year(@start);
SET @mo_start = month(@start);
SET @dt_start = CONVERT(date,CONVERT(varchar(50),(@yr_start*10000 + @mo_start*100 + 1)),112);

IF @end is NULL
  SET @dt_end = CONVERT(date,CONVERT(varchar(50),(@yr_end*10000 + 12*100 + 31)),112);
ELSE 
  SET @dt_end = COALESCE(@end, CONVERT(date,CONVERT(varchar(50),(@yr_end*10000 + 12*100 + 31)),112));

SET @yr_end = year(@dt_end);
SET @mo_end = month(@dt_end);
-- print(@dt_start);
-- print(@dt_end);

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

DECLARE @having nvarchar(70);
IF (@mean_threshold is NULL OR @mean_threshold <= 1)
  SET @having = N''
ELSE
  SET @having = N' HAVING (SUM([data_no]) >= @mean_threshold)';

DECLARE @depas int
SET @depas = -1; 
DECLARE @deprng nvarchar(40);
SET @deprng = N'';
IF (((@dep0 is NULL AND @dep1 is NULL AND @dep_mode is NULL) OR ISNUMERIC(@dep_mode) = 1) AND (@mode IS NULL OR @mode <> 'raw'))
  BEGIN
  IF (ISNUMERIC(@dep_mode) = 1 AND convert(int,@dep_mode) >= 5)
    SET @depas = convert(int,@dep_mode);
  ELSE
    SET @depas = 10; -- default each 10m as a group of range
  END
ELSE IF (ISNUMERIC(@dep_mode) = 1 AND @mode = 'raw')
  SET @dep_mode = NULL

--IF (@depas > 0)
-- BEGIN
--  IF (@dep0 is not NULL AND @dep1 is not NULL)
--	SET @deprng = N' AND CEILING([pressure] / @depas) * @depas BETWEEN @dep0 AND @dep1'
--  ELSE IF (@dep0 is not NULL AND @dep1 is NULL)
--	SET @deprng = N' AND CEILING([pressure] / @depas) * @depas <= @dep0'
--  ELSE IF (@dep0 is NULL AND @dep1 is not NULL)
--	SET @deprng = N' AND CEILING([pressure] / @depas) * @depas >= @dep1'
--  END
IF (@dep_mode is NULL OR @dep_mode = 'range' OR @dep_mode = 'mean' OR @depas > 0)
  BEGIN
  IF (@dep0 is not NULL AND @dep1 is not NULL)
	SET @deprng = N' AND [pressure] BETWEEN @dep0 AND @dep1'
  ELSE IF (@dep0 is not NULL AND @dep1 is NULL)
    SET @deprng = N' AND [pressure] >= @dep0'
  ELSE IF (@dep0 is NULL AND @dep1 is not NULL)
  	SET @deprng = N' AND [pressure] <= @dep1'
  END
ELSE IF (@dep0 is not NULL AND @dep_mode = 'exact')
  SET @deprng = N' AND [pressure] = @dep0'


DECLARE @colvars nvarchar(MAX);
SET @colvars = N'"longitude_degree" as longitude, "latitude_degree" as latitude, -1 as time_period, "pressure" as "depth", [temp_avg] as "temperature", [sal_avg] as "salinity", [den_avg] as "density", [flC_avg] as "fluorescence", [tran_avg] as "transmission", [ox_avg] as "oxygen", [year] as "year", [month] as "month", [data_no] as "count"'; 

DECLARE @colavg nvarchar(300);
SET @colavg= N', AVG([temp_avg]) as "temperature", AVG([sal_avg]) as "salinity", AVG([den_avg]) as "density", AVG([flC_avg]) as "fluorescence", AVG([tran_avg]) as "transmission", AVG([ox_avg]) as "oxygen", SUM([data_no]) as "count"';

DECLARE @colgrp nvarchar(300);
SET @colgrp = N'';

DECLARE @periodqry nvarchar(300);
SET @periodqry = N'';

DECLARE @nmo int
SET @nmo = 0;
DECLARE @nmorng nvarchar(40);
SET @nmorng = N'';

IF (ISNUMERIC(@mode) = 1)
  BEGIN
  SET @nmo = convert(int,@mode);
  SET @nmorng = N'time_period = @nmo';
  END

DECLARE @dep_change_flag int
SET @dep_change_flag = 1;

IF (@mode = 'month' OR (ISNUMERIC(@mode) = 1 AND @nmo IN (1,2,3,4,5,6,7,8,9,10,11,12)))
    BEGIN
      SET @periodqry = N', month';
	  SET @colgrp = N'"longitude_degree" as longitude, "latitude_degree" as latitude, "month" as time_period, ';
    END  
ELSE IF (@mode = 'season' OR (ISNUMERIC(@mode) = 1 AND @nmo IN (13,14,15,16)))
    BEGIN
      SET @periodqry = N', CASE WHEN [month] IN (12,1,2) THEN 13 WHEN [month] IN (3,4,5) THEN 14 WHEN [month] IN (6,7,8) THEN 15 WHEN [month] IN (9,10,11) THEN 16 END'; 
	  SET @colgrp = N'"longitude_degree" as longitude, "latitude_degree" as latitude, CASE WHEN [month] IN (12,1,2) THEN 13 WHEN [month] IN (3,4,5) THEN 14 WHEN [month] IN (6,7,8) THEN 15 WHEN [month] IN (9,10,11) THEN 16 END as time_period, ';
    END
ELSE IF (@mode = 'monsoon' OR (ISNUMERIC(@mode) = 1 AND @nmo IN (17,18)))
    BEGIN
      SET @periodqry = N', CASE WHEN [month] IN (10,11,12,1,2,3,4) THEN 17 WHEN [month] IN (5,6,7,8,9) THEN 18 END'; 
	  SET @colgrp = N'"longitude_degree" as longitude, "latitude_degree" as latitude, CASE WHEN [month] IN (10,11,12,1,2,3,4) THEN 17 WHEN [month] IN (5,6,7,8,9) THEN 18 END as time_period, ';
    END
ELSE IF ((@mode is NULL) OR @mode != 'raw' OR (ISNUMERIC(@mode) = 1 AND @nmo = 0)) -- mode is yearly mean
    BEGIN
      SET @periodqry = N'';
	  SET @colgrp = N'"longitude_degree" as longitude, "latitude_degree" as latitude, 0 as time_period, ';
    END
ELSE
    SET @dep_change_flag = 0;

IF (@dep_change_flag = 1)
    BEGIN
      IF (@dep_mode = 'mean')
        SET @colvars = @colgrp + 'convert(int,AVG([pressure])) as "depth"' + @colavg;
      ELSE IF (@dep0 is not NULL AND @dep_mode = 'exact')
        SET @colvars = @colgrp + '@dep0 as "depth"' + @colavg;
      ELSE IF (@depas > 0)
        SET @colvars = @colgrp + 'CEILING([pressure] / @depas) * @depas as "depth" ' + @colavg;
      ELSE
        SET @colvars = @colgrp + '"pressure" as "depth"' + @colavg;
    END

DECLARE @whereis nvarchar(300);
SET @whereis = N'CAST(CONVERT(date,CONVERT(varchar(50),([year]*10000 + [month]*100 + 1)),112) as date) BETWEEN @dt_start AND @dt_end AND [longitude_degree] BETWEEN @lon0 AND @lon1 AND [latitude_degree] BETWEEN @lat0 AND @lat1' + @deprng;

print @lon0
print @lon1
print @colgrp

-- DECLARE @orderis nvarchar(100);
-- SET @orderis = N'longitude,latitude';

DECLARE @limitis nvarchar(20);
-- SET @limitis = CASE WHEN @limit <= 0 THEN N'' else N'TOP(@limit) ' END;
-- inner query 不限制筆數，避免先取未排序資料
SET @limitis = N'';

DECLARE @outerlimitis nvarchar(100);
SET @outerlimitis = CASE WHEN @limit <= 0 THEN N'' ELSE N'TOP(@limit) ' END;

DECLARE @sqlcmd nvarchar(MAX);
IF (@mode = 'raw')
  SET @sqlcmd = N'SELECT ' + @limitis + @colvars + ' FROM dbo.VIEW_CTD_GRID15MOA_yyyymm WHERE ' + @whereis; -- + ' ORDER BY ' + @orderis;
ELSE --IF (@mode is NULL OR @mode != 'raw')
  BEGIN
  -- SET @colvars = @colvars + ', SUM([data_no]) as "count" '
  IF ((@dep0 is not NULL AND @dep_mode = 'exact') OR (@dep_mode = 'mean'))
    SET @sqlcmd = N'SELECT ' + @limitis + @colvars + ' FROM dbo.VIEW_CTD_GRID15MOA_yyyymm WHERE ' + @whereis + ' GROUP BY ' + '[longitude_degree], [latitude_degree]' + @periodqry + @having;
  ELSE IF (@depas > 0)
    SET @sqlcmd = N'SELECT ' + @limitis + @colvars + ' FROM dbo.VIEW_CTD_GRID15MOA_yyyymm WHERE ' + @whereis + ' GROUP BY ' + '[longitude_degree], [latitude_degree], CEILING([pressure] / @depas)' + @periodqry + @having;
  ELSE 
    SET @sqlcmd = N'SELECT ' + @limitis + @colvars + ' FROM dbo.VIEW_CTD_GRID15MOA_yyyymm WHERE ' + @whereis + ' GROUP BY ' + '[longitude_degree], [latitude_degree], [pressure]' + @periodqry + @having;
  END

IF (@nmorng <> N'')
  BEGIN
  IF (@mode = 'raw')
    SET @sqlcmd = 'SELECT ' + @outerlimitis + 'longitude,latitude,time_period,depth,' + @append + ',year,month from (' + @sqlcmd + ') a where a.' + @nmorng;
  ELSE
    SET @sqlcmd = 'SELECT ' + @outerlimitis + 'longitude,latitude,time_period,depth,' + @append + ' from (' + @sqlcmd + ') a where a.' + @nmorng;
  END
ELSE
  BEGIN
  IF (@mode = 'raw')
    SET @sqlcmd = 'SELECT ' + @outerlimitis + 'longitude,latitude,time_period,depth,' + @append + ',year,month from (' + @sqlcmd + ') a';
  ELSE
    SET @sqlcmd = 'SELECT ' + @outerlimitis + 'longitude,latitude,time_period,depth,' + @append + ' from (' + @sqlcmd + ') a';
  END

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

print @sqlcmd;
EXEC sp_executesql @sqlcmd, 
  N'@limit int, @dt_start DATETIME, @dt_end DATETIME, @lon0 float, @lon1 float, @lat0 float, @lat1 float, @dep0 numeric, @dep1 numeric, @mean_threshold int, @nmo int, @depas int', 
  @limit = @limit, @dt_start = @dt_start, @dt_end = @dt_end, @lon0 = @lon0, @lon1 = @lon1, @lat0 = @lat0, @lat1 = @lat1, @dep0 = @dep0, @dep1 = @dep1, @mean_threshold = @mean_threshold, @nmo = @nmo, @depas = @depas;

END
