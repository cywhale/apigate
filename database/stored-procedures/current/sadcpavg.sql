USE [odbphy]
GO
/****** Object:  StoredProcedure [dbo].[sadcpavg]    Script Date: 2026/9/11 下午 12:40:46 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- Author:		cywhale
-- Create date: 2022/07/20
-- Description:	sadcp(_10m) mean field
-- =============================================
ALTER PROCEDURE [dbo].[sadcpavg] 
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
	@limit int = NULL,
	@mean_threshold int = NULL,
	@append varchar(200) = 'u,v' --,count
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    -- Insert statements for procedure here
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
  BEGIN
    if (@dep_mode = 'mean')
	  SET @having = N' HAVING (SUM([data_no]) >= @mean_threshold)';
	ELSE
      SET @having = N' AND [data_no] >= @mean_threshold';
  END

DECLARE @deprng nvarchar(40);
SET @deprng = N'';
IF (@dep_mode is NULL OR @dep_mode = 'range' OR @dep_mode = 'mean')
  BEGIN
    IF (@dep0 is not NULL AND @dep1 is not NULL)
	  SET @deprng = N' AND [depth] BETWEEN @dep0 AND @dep1'
    ELSE IF (@dep0 is not NULL AND @dep1 is NULL)
	  SET @deprng = N' AND [depth] >= @dep0'
    ELSE IF (@dep0 is NULL AND @dep1 is not NULL)
	  SET @deprng = N' AND [depth] <= @dep1'
  END
ELSE IF (@dep0 is not NULL AND @dep_mode = 'exact')
  SET @deprng = N' AND [depth] = @dep0'

DECLARE @colvars nvarchar(300);
IF (@dep_mode = 'mean')
  SET @colvars = N'longitude_degree as longitude, latitude_degree as latitude, Time_period as time_period, convert(int,AVG([depth])) as "depth", AVG([u_avg]) as "u", AVG([v_avg]) as "v",  dbo.Distance_uv(AVG(u_avg),AVG(v_avg)) as "speed", dbo.Bearing_uv(AVG(u_avg),AVG(v_avg)) as "direction", SUM([data_no]) as "count"';
ELSE
  SET @colvars = N'longitude_degree as longitude, latitude_degree as latitude, Time_period as time_period, depth as "depth", u_avg as "u", v_avg as "v", speed as "speed", direction as "direction", [data_no] as "count"';

DECLARE @periodqry nvarchar(50);
-- SET @periodqry = N' AND Time_period=0'; --default is year average
SET @periodqry = N' AND Time_period=''0'''

IF (ISNUMERIC(@mode) = 1)
  BEGIN
    -- SET @periodqry = N' AND Time_period=convert(int,@mode)';
	SET @periodqry = N' AND Time_period=@mode'
  END
ELSE
  /*
  BEGIN
  IF (@mode = 'month')
    BEGIN
      SET @periodqry = N' AND Time_period IN (1,2,3,4,5,6,7,8,9,10,11,12)';
    END  
  ELSE IF (@mode = 'season')
    BEGIN
      SET @periodqry = N' AND Time_period IN (13,14,15,16)';
    END
  ELSE IF (@mode = 'monsoon')
    BEGIN
      SET @periodqry = N' AND Time_period IN (17,18)';
    END
  END
  */
  BEGIN
  IF (@mode = 'month')
    BEGIN
      SET @periodqry = N' AND Time_period IN (''1'',''2'',''3'',''4'',''5'',''6'',''7'',''8'',''9'',''10'',''11'',''12'')';
    END  
  ELSE IF (@mode = 'season')
    BEGIN
      SET @periodqry = N' AND Time_period IN (''13'',''14'',''15'',''16'')';
    END
  ELSE IF (@mode = 'monsoon')
    BEGIN
      SET @periodqry = N' AND time_period IN (''17'',''18'')';
    END
  END
/*
ELSE IF (@mode = 'year')
  BEGIN
    SET @periodqry = N' AND Time_period=0';
  END
*/
DECLARE @whereis nvarchar(200);
IF (@dep_mode = 'mean')
  SET @whereis = N'longitude_degree BETWEEN @lon0 AND @lon1 AND latitude_degree BETWEEN @lat0 AND @lat1' + @deprng;
ELSE
  SET @whereis = N'longitude_degree BETWEEN @lon0 AND @lon1 AND latitude_degree BETWEEN @lat0 AND @lat1' + @deprng + @having;

DECLARE @limitis nvarchar(100);
-- SET @limitis = CASE WHEN @limit <= 0 THEN N'' else N'TOP(@limit) ' END;
/* print @limitis;*/
-- inner query 不限制筆數，避免先取未排序資料
SET @limitis = N'';

DECLARE @outerlimitis nvarchar(100);
SET @outerlimitis = CASE WHEN @limit <= 0 THEN N'' ELSE N'TOP(@limit) ' END;

DECLARE @sqlcmd nvarchar(MAX);
SET @sqlcmd = N'SELECT ' + @limitis + @colvars + ' FROM dbo.VIEW_SADCP_GRID15MOA_2015 WHERE ' + @whereis + @periodqry;

IF (@dep_mode = 'mean')
  SET @sqlcmd = @sqlcmd + ' GROUP BY ' + 'longitude_degree, latitude_degree, Time_period' + @having;

-- SET @sqlcmd = 'SELECT longitude,latitude,time_period,depth,' + @append + ' from (' + @sqlcmd + ') a';
SET @sqlcmd =
    'SELECT ' + @outerlimitis +
    'longitude,latitude,time_period,depth,' + @append +
    ' FROM (' + @sqlcmd + ') a';

if (@yorder != 0 OR @xorder != 0)
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
ELSE
  SET @sqlcmd = @sqlcmd + ' ORDER BY longitude, latitude'

print @sqlcmd;
EXEC sp_executesql @sqlcmd, 
  N'@limit int, @lon0 float, @lon1 float, @lat0 float, @lat1 float, @dep0 numeric, @dep1 numeric, @mean_threshold int, @mode nvarchar(10)', 
  @limit = @limit, @lon0 = @lon0, @lon1 = @lon1, @lat0 = @lat0, @lat1 = @lat1, @dep0 = @dep0, @dep1 = @dep1, @mean_threshold = @mean_threshold, @mode = @mode;

END
