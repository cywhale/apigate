//import Spkey from '../models/spkey_mongoose'
import S from 'fluent-json-schema'
//import { stringify } from 'JSONStream' //stringifyObject
import { Readable } from 'node:stream' //Transform, PassThrough
import { finished } from 'stream/promises'
//import fastJson from 'fast-json-stringify'
//import Sequelize from 'sequelize'
//import parser from 'stream-json'
//import streamArray from 'stream-json/streamers/StreamArray'
//import zlib from 'zlib';

//export const autoPrefix = process.env.NODE_ENV === 'production'? '/api' : '/apitest'
export const autoPrefix = '/api'

export default async function apirest (fastify, opts, next) {
/* sadcp data looks like
  odb_cruise_id longitude_degree latitude_degree               GMT+8 depth
1    OR10277            119.9939        21.88746 1991-04-20 19:11:00   150
2    OR10277            119.9939        21.88746 1991-04-20 19:11:00   240
       u     v  w direction speed ship_direction ship_speed ship_u ship_v
1 -0.934 0.449 NA     295.6 1.036             NA         NA     NA     NA
2 -0.923 0.682 NA     306.4 1.147             NA         NA     NA     NA
*/
/* In SQL
CAST_NAME,
str(longitude_degree,9,4) as "Longitude(deg.)",
str(latitude_degree,9,4) as "Latitude(deg.)",
convert(nchar(19),[GMT+8],126)as "Local_time(GMT+8)",
str (Depth,5)as "Depth(m)",
str(u,8,3)as "U(m/s)",
str (v,8,3)as "V(m/s)",
str(direction,6,1)as "Direction(deg.)",
str(speed, 8, 3) as "Speed(m/s)"
*/
//ref: https://stackoverflow.com/questions/52987837/nodejs-unable-to-import-sequelize-js-model-es6
  const limited_yrs = 3 //for CTD, SADCP, cannot reveal last 3 yrs data
  const limited_row = 100 // for raw file limitation
  const grd15moa = deg => { return(parseInt((deg-0.125) / 0.25) * 0.25 + 0.25) } //gridded to 0.25-degree = 15 minute of arc

  const grdMissingVal = (res, xmin, grdx, grdy, curx, cury, gcnt, gi, gj, ix, iy, nx, tp) => {
  /*let period
    if (mode === 'monsoon') {
      period = [17,18]
    } else if (mode === 'season') {
      period = [13,14,15,16]
    } else if (mode === 'month') {
      period = [1,2,3,4,5,6,7,8,9,10,11,12]
    } else {
      period = [0]
    }*/
    let gap = 0
    let ygap = 0
    let xdif = 0
    let xgap = 0
    //let nval = null
    let cx = curx
    let cy = cury
    if (cury !== grdy) {
      ygap = parseInt((grdy - cury)/iy)
      xdif = nx - parseInt((grdx - xmin)/ix)
      xgap = parseInt((curx - xmin)/ix)
      gap = xdif + (ygap-1) * nx + xgap //lat (y) is DESC in order
      cy = grdy - ygap * iy
      cx = xmin + xgap * ix
      xdif = xgap
    } else {
      xgap = parseInt((curx - grdx)/ix)
      gap = xgap
      cx = grdx + xgap * ix
      xdif = gi + xgap
    }
    let obj, str
    let out = []
    for (let i = 0; i < gap; i++) {
    /*  it works if all time-period missing value needed to be filled. but now only fill one
      obj = tp.reduce((prev, curr) => {
        let tx = {};
        tx[`${curr}`] = {"u":null,"v":null}
        return {...prev, ...tx}
      },{})
    */
      obj = {}
      obj[`${tp[0]}`] = {"u":null,"v":null}
      if (gcnt === 0) {
        if (i===0) {
          str = `${JSON.stringify(obj)}`
        } else {
          str = `,${JSON.stringify(obj)}`
        }
      } else {
        if (i===0) {
          str = `},${JSON.stringify(obj)}` //to end previous non-null {...,period:{u,v}}
        } else {
          str = `,${JSON.stringify(obj)}`
        }
      }
      res.raw.write(str)
      out.push(str)
    }
    //fastify.log.info("Missing value UVgrid for x-y gap: " + xdif + "-" + ygap + ". Jump to cx,cy: " + cx + ", " + cy)
    return {
      cx: cx,
      cy: cy,
      gap: gap,
      di: xdif,
      dj: gj + ygap,
      out: out
    }
  }

//ref: https://github.com/MatteoDiPaolo/googleTakeoutLocations-to-geoJson
  const toSadcpGeoJsonRow = row => {
    return {
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [
                row.longitude,
                row.latitude,
            ]
        },
        properties: {
            //datetime: row.datetime,
            time_period: row.time_period, //|| null //but 0 cause null
            depth: row.depth,
            u: row.u,
            v: row.v,
            count: row.count
            //direction: row.direction || null,
            //speed: row.speed || null
        }
    }
  }

  const toCtdGeoJsonRow = row => {
    return {
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [
                row.longitude,
                row.latitude,
            ]
        },
        properties: {
            time_period: row.time_period,
            depth: row.depth,
            temperature: row.temperature,
            salinity: row.salinity,
            fluorescence: row.fluorescence,
            transmission: row.transmission,
            oxygen: row.oxygen,
            count: row.count
        }
    }
  }

  const { sqldb, streamCache } = fastify
// if use Sequelize as solution 202205....
/* sqldb.define('sadcp', {
    longitude: {type: Sequelize.FLOAT},
    latitude: {type: Sequelize.FLOAT},
    datetime: {type: Sequelize.STRING},
    depth: {type: Sequelize.INTEGER},
    u: {type: Sequelize.FLOAT},
    v: {type: Sequelize.FLOAT},
    direction: {type: Sequelize.FLOAT},
    speed: {type: Sequelize.FLOAT}
  }, {
      tableName: fastify.config.TABLE_ADCP,
      timestamps: false,
      createdAt: false,
  })
  const sadcpMdl = sqldb.models.sadcp
*/
  const sadcpJsonSchema = S.object()
    .id('#sadcpjson')
    .description('SADCP ok (in JSON)')
    .prop('longitude', S.number())
    .prop('latitude', S.number())
    .prop('time_period', S.integer())
    .prop('depth', S.number())
    .prop('u', S.number())
    .prop('v', S.number())
    .prop('direction', S.number())
    .prop('speed', S.number())
    .prop('datetime', S.string())
    .prop('year', S.integer())
    .prop('month', S.integer())
    .prop('count', S.integer())
/*  {
    longitude: { type: 'number' },
    latitude: { type: 'number' },
    datetime: { type: 'string' },
    depth: { type: 'integer' },
    u: { type: 'number' },
    v: { type: 'number' },
    direction: { type: 'number' },
    speed: { type: 'number' }
  }*/

  const sadcpGJsonSchema = S.object()
    .id('#sadcpgjson')
    .description('SADCP ok (in GeoJSON)')
    .prop('type', S.string())
    .prop('geometry', S.object()
        .prop('type', S.string())
        .prop('coordinates', S.array().minItems(2).items(S.number())))
    .prop('properties', S.object()
        .prop('time_period', S.integer())
        .prop('depth', S.number())
        .prop('u', S.number())
        .prop('v', S.number())
        //.prop('direction', S.number())
        //.prop('speed', S.number())
        //.prop('datetime', S.string())
        .prop('count', S.integer())
       )

  const ctdJsonSchema = S.object()
    .id('#ctdjson')
    .description('CTD ok (in JSON)')
    .prop('longitude', S.number())
    .prop('latitude', S.number())
    .prop('time_period', S.integer())
    .prop('depth', S.number())
    .prop('temperature', S.number())
    .prop('salinity', S.number())
    .prop('fluorescence', S.number())
    .prop('transmission', S.number())
    .prop('oxygen', S.number())
    .prop('cruise', S.string())
    .prop('cast', S.string())
    .prop('datetime', S.string())
    .prop('year', S.integer())
    .prop('month', S.integer())
    .prop('count', S.integer())

  const ctdGJsonSchema = S.object()
    .id('#ctdgjson')
    .description('CTD ok (in GeoJSON)')
    .prop('type', S.string())
    .prop('geometry', S.object()
        .prop('type', S.string())
        .prop('coordinates', S.array().minItems(2).items(S.number())))
    .prop('properties', S.object()
        .prop('time_period', S.integer())
        .prop('depth', S.number())
        .prop('temperature', S.number())
        .prop('salinity', S.number())
        .prop('fluorescence', S.number())
        .prop('transmission', S.number())
        .prop('oxygen', S.number())
        .prop('count', S.integer())
       )
/*
  const constraint = {
    response: {
      constraint: function (req) {
        let format = req.query.format??'geojson'
        fastify.log.info("Select Schema: " + format)
        switch(format){
          case 'json': return '#sadcpjson'
          case 'geojson': return '#sadcpgjson'
          default: return '#sadcpgjson'
        }
      }
    }
  }
  fastify.register(import('../config/sadcpSchemaMdl.js'), constraint)
*/
  const queryPipe = async (req, reply, keyx='sadcp') => {
      const qstr = req.query
      let start='1991-01-01'
      let end = 'NULL' //'' before modifed query to stored procedure in mssql 20220505
      let startd = Date.parse(start)
      let endd = Date.parse((new Date().getUTCFullYear()-limited_yrs).toString()+"-01-01")
      let allspan_avg_flag = 1 // modified 20220720: 2:for all time-span use sadcpavg procedure to fetch pre-calculated table
                               // 1: have time-specific requirement use sadcpgridqry procedure (yyyymm);
                               // 0: only for non gridded raw mode: sadcpqry
      let qkey, vars, append   // vars: possible output variables from database
      if (keyx==='sadcp') {
        qkey = 'SADCP_'
        vars = ['u', 'v', 'direction', 'speed', 'count']
        append = 'u,v'
      } else {
        qkey = 'CTD_'
        vars = ['temperature', 'salinity', 'fluorescence', 'transmission', 'oxygen', 'count']
        append = 'temperature'
      }

      if (typeof qstr.start == 'undefined' && typeof qstr.end == 'undefined') {
        allspan_avg_flag = 2
        qkey = qkey + start + '_NA'
        start = `"${start}"` //end='NULL' default
      } else {
        if (typeof qstr.start !== 'undefined') {
          if (/^\d+\.?\d*$/.test(qstr.start) && qstr.start.length===8) {
            start = qstr.start.substring(0, 4) + '-' + qstr.start.substring(4, 6) + '-' + qstr.start.substring(6)
            if (isNaN(Date.parse(start))) {
              fastify.log.info("Warning: Wrong start date format: " + start)
              start='1991-01-01'
            } else {
              startd = Date.parse(start)
            }
          }
        }
        qkey = qkey + start
        start = `"${start}"`

        if (typeof qstr.end !== 'undefined') {
          if (/^\d+\.?\d*$/.test(qstr.end) && qstr.end.length===8) {
            end = qstr.end.substring(0, 4) + '-' + qstr.end.substring(4, 6) + '-' + qstr.end.substring(6)
            if (isNaN(Date.parse(end))) {
              fastify.log.info("Warning: Wrong end date format: " + end)
              end='NULL'
            } else {
              if (Date.parse(end) >= endd) {
                fastify.log.info("Warning: End date exceed limited last 3-years: " + end)
                end = (new Date().getUTCFullYear()-limited_yrs-1).toString()+"-12-31"
              } else {
                endd = Date.parse(end)
              }
            }
          }
        }
      }
      if (!(/^raw/.test(qstr.mode)) && startd <= Date.parse('1991-12-31') && (end === 'NULL' ||
          endd === Date.parse((new Date().getUTCFullYear()-limited_yrs-1).toString()+"-12-31"))) {
        fastify.log.info("Warning: Use full-span date: " + start + "-" + end)
        allspan_avg_flag = 2
      }

      if (end === 'NULL') {
        qkey = qkey + '_NA'
      } else {
        qkey = qkey + '_' + end
        end = `"${end}"`
      }

      let limit = 0
      if (typeof qstr.limit !== 'undefined') {
        if (Number.isInteger(Number(qstr.limit)) && Number(qstr.limit) > 0) {
          limit = parseInt(qstr.limit)
          //qkey = qkey + '_' + limit.toString() //determined later
        }
      }
      //fastify.log.info("url: " + req.url)
      // 202207: addd dep_mode for depth ('range', 'mean', 'exact': use only dep0)
      let dep_mode = 'NULL'
      if (typeof qstr.dep_mode !== 'undefined') {
        if (keyx==='ctd' && Number.isInteger(Number(qstr.dep_mode)) && Number(qstr.dep_mode) > 0) {
          dep_mode = qstr.dep_mode //Note if parseInt(qstr.dep_mode) < 5, in SQl, it will be converted to default 10m
          // ....................... (but only in CTD mode) and in SQL, dep0, dep1, dep_mode NULL, auto-converted to 10m, too 
        } else {
          dep_mode = qstr.dep_mode.toLowerCase()
          if (dep_mode !== 'range' && dep_mode !== 'mean' && dep_mode !== 'exact') {
            dep_mode = 'NULL'
          }
        }
      }

      let cruise = ''
      if (keyx === 'ctd') { //202305 add query cruise mode for CTD
        if (typeof qstr.cruise !== 'undefined' && qstr.cruise.trim()) {
          cruise = qstr.cruise.trim()
          //fastify.log.info("In cruise query mode: " + cruise)
          allspan_avg_flag = 0 //in ctdavg, ctdgridqry procedure, no cruise column in those tables.
          // so don't use cruise mode if no need for querying CTD, that will use larger table to query (ctdqry) so that slower
          // In other words, cruise mode is designed/uesed only for chemistry viewer, not for general cases.
          qkey = qkey + '_' + cruise
        } else {
          qkey = qkey + '_NOcrqry'
        }
      }

      /*let mean = true //20220518 modified stored procedure in SQL SERVER that parameter 'mean' is replaced by mode
        let mode = (qstr.mode??'average').toLowerCase() //'raw', may transfer huge data
        if (mode === 'raw' ) { mean = false } */
      // 202207: add raw0: means real raw data; raw1: gridded raw data but all limit 1000/limited_row
      let mode = 'NULL'
      let period = [0]
      if (typeof qstr.mode !== 'undefined') {
        mode = qstr.mode.toLowerCase() //'raw', may transfer huge data
        if (mode === 'monsoon') {
          period = [17,18]
        } else if (mode === 'season') {
          period = [13,14,15,16]
        } else if (mode === 'month') {
          period = [1,2,3,4,5,6,7,8,9,10,11,12]
        } else if (/^raw/.test(mode)) {
          if (!cruise || mode !== 'rawx') { limit = limited_row } //202305 add query cruise mode for CTD
        } else {
          if (Number.isInteger(Number(qstr.mode))) {
            //fastify.log.info("Mode is integer!" + qstr.mode)
            mode = qstr.mode
            period = [parseInt(mode)]
          } else {
            mode = 'default' //default: is year mean
          }
        }
        qkey = qkey + '_' + mode
        if (mode === 'raw0' || (mode === 'rawx' && cruise)) { //202305 add query cruise mode for CTD
          allspan_avg_flag = 0
          mode = 'raw'
        } else if (/^raw/.test(mode)) { //i.e. raw or raw1
          if (!cruise) { //202305 add query cruise mode for CTD
            allspan_avg_flag = 1
          } else {
            allspan_avg_flag = 0
          }
          mode = 'raw'
        }
      }

      let xorder = 'NULL'
      if (typeof qstr.xorder !== 'undefined') {
        if (Number.isInteger(Number(qstr.xorder))) {
          xorder = parseInt(qstr.xorder)
        }
      }

      let yorder = 'NULL'
      if (typeof qstr.yorder !== 'undefined') {
        if (Number.isInteger(Number(qstr.yorder))) {
          yorder = parseInt(qstr.yorder)
        }
      }

      let format = (qstr.format??'json').toLowerCase() //'json', 'geojson', 'uvgrid'
      if (keyx === 'sadcp') { //only SADCP has uvgrid mode
        if (format === 'uvgrid') {
          if (/raw/.test(mode)) {
            mode = 'NULL';
            if (allspan_avg_flag === 0) { allspan_avg_flag = 1 } //cannot be raw in uvgrid format
          }
          if (dep_mode === 'NULL' || /range/.test(dep_mode)) {
            dep_mode = 'mean';  //cannot be multiple values for depth in uvgrid format
          }
          limit = 0
          yorder = -2 //must DESC, and ordered by lat, lon
          xorder = 1  //must increasing
          //fastify.log.info("Test UVgrid mode: " + mode + " with period: " + JSON.stringify(period))
        }
      }
      qkey = qkey + '_' + format

      let appendx = []
      let vset
      if (typeof qstr.append !== 'undefined') {
        if (keyx !== 'sadcp' || format !== 'uvgrid') {
          vset= new Set(qstr.append.trim().split(/\s*,\s*/));
          appendx = vars.filter(item => vset.has(item));
          //fastify.log.info("Receive: " + qstr.append + " and Append: " + `"${appendx.join(',')}"`)
        }
      }
      if (appendx.length) {
        append = appendx.join(',')
      }
      qkey = qkey + '_' + append
      append = `"${append}"`

      if (dep_mode === 'NULL') {
        qkey = qkey + '_NA'
      } else {
        qkey = qkey + '_' + dep_mode
        dep_mode = `"${dep_mode}"`
      }

      if (mode === 'NULL') {
        qkey = qkey + '_' + 'default'
      } else {
        qkey = qkey + '_' + mode + '_' + allspan_avg_flag.toString()
        mode = `"${mode}"`
      }

      let mean_threshold = qstr.mean_threshold??-1
      let lon0 = qstr.lon0??105
      let lon1 = qstr.lon1??135
      let lat0 = qstr.lat0??2
      let lat1 = qstr.lat1??35
      let dep0 = qstr.dep0??-1
      let dep1 = qstr.dep1??-1
      //let std = (qstr.std??'').toLowerCase() //'woa13': `dbo.NODC_Standard_depths_woa13 group by depth`
      //let output = (qstr.output??'').toLowerCase()    //'file', file output (not yet)
      let qry = `USE [${fastify.config.SQLDBNAME}];
                 EXEC [dbo].`
      if (allspan_avg_flag==2) {
        fastify.log.info(`Note: Only query stored mean-field table by ${keyx}avg procedure!`)
        qry= qry + `[${keyx}avg] @lon0=${lon0}, @lon1=${lon1}, @lat0=${lat0}, @lat1=${lat1}, @dep0=${dep0}, @dep1=${dep1}, @dep_mode=${dep_mode}, ` +
                   `@mode=${mode}, @xorder=${xorder}, @yorder=${yorder}, @limit=${limit}, @mean_threshold=${mean_threshold}, @append=${append}`
      } else if (allspan_avg_flag==1) {
        fastify.log.info(`Note: Only query stored mean-field table by ${keyx}gridqry procedure!`)
        qry= qry + `[${keyx}gridqry] @lon0=${lon0}, @lon1=${lon1}, @lat0=${lat0}, @lat1=${lat1}, @dep0=${dep0}, @dep1=${dep1}, @dep_mode=${dep_mode}, ` +
                   `@mode=${mode}, @xorder=${xorder}, @yorder=${yorder}, @start=${start}, @end=${end}, @limit=${limit}, @mean_threshold=${mean_threshold}, @append=${append}`
      } else {
        fastify.log.info(`Note: Query original table by ${keyx}qry procedure!`)
        qry= qry + `[${keyx}qry] @lon0=${lon0}, @lon1=${lon1}, @lat0=${lat0}, @lat1=${lat1}, @dep0=${dep0}, @dep1=${dep1}, @dep_mode=${dep_mode}, ` +
                   `@mode=${mode}, @xorder=${xorder}, @yorder=${yorder}, @start=${start}, @end=${end}, @limit=${limit}, @mean_threshold=${mean_threshold}, @append=${append}`
      }
      //202305 add query cruise mode for CTD
      if (cruise) {
        cruise = `"${cruise}"`
        qry = qry + `, @cruise=${cruise};`
      } else {
        qry = qry + ';'
      }
      //let qkey=`${lon0}_${lon1}_${lat0}_${lat1}_${start}_${end}_${limit}_${mode}_${mean_threshold}_${xorder}_${yorder}`
      if (limit === 'NULL') {
        qkey = qkey + '_' + 'NA'
      } else {
        qkey = qkey + '_' + limit.toString()
      }
      if (xorder === 'NULL') {
        qkey = qkey + '_' + 'NA'
      } else {
        qkey = qkey + '_' + xorder.toString()
      }
      if (yorder === 'NULL') {
        qkey = qkey + '_' + 'NA'
      } else {
        qkey = qkey + '_' + yorder.toString()
      }
      qkey = qkey + '_' + limit.toString() + '_' + mean_threshold.toString() + '_' + lon0.toString() + '_' + lon1.toString() +
             '_' + lat0.toString() + '_' + lat1.toString() + '_' + dep0.toString() + '_' + dep1.toString()
    //fastify.log.info(keyx + "Query key is: " + qkey)
      fastify.log.info(keyx + "Query command is: " + qry)
/*    return({qry: qry,
              qkey: qkey,
              format: format,
              lon0: lon0,
              lon1: lon1,
              lat0: lat0,
              lat1: lat1}) */
//  ============================== NODE Stream pipe ======================== //
    reply.type('application/json')
    const toGeoJsonRow = keyx === 'sadcp'? toSadcpGeoJsonRow : toCtdGeoJsonRow
    const cached = streamCache.get(qkey)
    if (cached) {
      fastify.log.info(keyx + " Cached Hit!! " + qkey)
      //reply.code(200)
      //reply.sent = true
      await cached.pipe(reply.raw)
      await reply.code(200)
      await reply.hijack() //deprecated: reply.sent = await true
    /*.on('end', () => {
          fastify.log.info("----Cache pipe end----")
          reply.sent = true
      })*/
      next()
    } else {
    //fastify.log.info(keyx + "!! Cached Miss: " + qkey)
    var count = 0
    let bbox = [grd15moa(lon0), grd15moa(lat0), grd15moa(lon1), grd15moa(lat1)]
    let grdnx= parseInt((bbox[2]-bbox[0])/0.25) + 1
    let grdny= parseInt((bbox[3]-bbox[1])/0.25) + 1
    let dx = 0.25
    let dy = 0.25
    //if (format==="uvgrid") {fastify.log.info("UV-grids format wit bbox: " + bbox + " and grid number: " + grdnx)}
    var dc = 0 //total counter: dc = di * dj //some grids are missing value, need fill null
    var di = 0 //x-grid counter
    var dj = 0 //y-grid counter
    var dp = 0 //time-period counter
    var gridx = bbox[0]
    var gridy = bbox[3] // note that latitude is decreasing in uvgrid format
    var chkmissFlag = true
    //var cacheout = [] //new PassThrough()
    const cacheout = new Readable({ objectMode: true })
    var predx = ''
    const pipex = (src, res) => { //, opts = {end: false})
      return new Promise((resolve, reject) => {
      /*src //it works
        .pipe(stringify())
        .pipe(res.raw) //, {end: false})*/
      /*src
        .pipe(zlib.createGunzip())
        .pipe(parser())
        .pipe(new streamArray()) */
        src.on('data', chunk => {
          let data
          let stat = {"gap":0}

          if (keyx === 'sadcp' && format === 'uvgrid') {
            if (count > 0 && (chunk.longitude !== gridx || chunk.latitude !== gridy)) {
              dp = 0 //dp is the counter of time-period, i.e if mode=='season', period is [13,14,15,16], dp is 0-1-2-3
              if (di >= grdnx) { //within the same dp, the counter (di, dj) are disabled to keep in the same gridx, gridy
                di = 0
                dj = dj + 1
                gridx = bbox[0]
                gridy = gridy - dy
              } else {
                di = di + 1
                gridx = gridx + dx
              }
              dc = dc + 1
              //fastify.log.info("Now compare (i,j): (" + di + ", " + dj + ") for grid: " + gridx + ", " + gridy + " with chunk: " + chunk.longitude + ", " + chunk.latitude)
              if (chunk.longitude === gridx && chunk.latitude === gridy) {
                chkmissFlag = false
              } else {
                chkmissFlag = true
              }
            } else if (chunk.longitude === gridx && chunk.latitude === gridy) {
              if (dp >= period.length) {
                fastify.log.info("Warning: time-period counter error: " + dp + " with period: " + period.length + " at n-th data: " + count)
              }
              chkmissFlag = false //if within the same dp, no need to check missing value on that grid
            } else {
              chkmissFlag = true
            }
          }

          if (count === 0) {
            if (format === 'geojson') {
              predx = `{"type":"FeatureCollection","features": [`
              res.raw.write(predx)
              cacheout.push(predx)
              data = JSON.stringify(toGeoJsonRow(chunk))
            } else if (keyx === 'sadcp' && format === 'uvgrid') { //JSON format for GFS: https://github.com/cambecc/grib2json/blob/master/README.md
              predx = `{"header":{"periodMode":${mode},"periodArray":${JSON.stringify(period)},"parameterCategory":11,"parameterNumber":1,"parameterNumberName":"UV-grids","parameterUnit":"m.s-1","refTime":null,"forcastTime":0,"lo1":${bbox[0]},"la1":${bbox[3]},"lo2":${bbox[2]},"la2":${bbox[1]},"nx":${grdnx},"ny":${grdny},"dx":${dx},"dy":${dy}},"data":[`
              res.raw.write(predx)
              cacheout.push(predx)
              //if (chkmissFlag) { //count == 0 always check
              stat = grdMissingVal(res, bbox[0], gridx, gridy, chunk.longitude, chunk.latitude, dc, di, dj, dx, dy, grdnx, period)
              //}
              if (stat.gap > 0) {
                //if (dp === 0) { // means at start of period //here dp must 0
                for(let i=0;i<stat.out.length;i++) {cacheout.push(stat.out[i])} //cacheout.push(...stat.out) //when using array
                data =`,{"${chunk.time_period}":${JSON.stringify({u:chunk.u,v:chunk.v})}`
                di = stat.di
                dj = stat.dj
                dc = dc + stat.gap
                gridx = stat.cx
                gridy = stat.cy
              } else {
                data =`{"${chunk.time_period}":${JSON.stringify({u:chunk.u,v:chunk.v})}`
              /*di = di + 1
                dc = dc + 1
                gridx = gridx + dx*/
              }
              dp = dp + 1
            } else {
              res.raw.write(`[`)
              cacheout.push(`[`)
              data = JSON.stringify(chunk)
            }
          } else {
            if (format === 'geojson') {
              data =`,${JSON.stringify(toGeoJsonRow(chunk))}`;
            } else if (keyx === 'sadcp' && format === 'uvgrid') {
              if (chkmissFlag) {
                stat = grdMissingVal(res, bbox[0], gridx, gridy, chunk.longitude, chunk.latitude, dc, di, dj, dx, dy, grdnx, period)
              }
              if (stat.gap > 0) {
                for(let i=0;i<stat.out.length;i++) {cacheout.push(stat.out[i])} //cacheout.push(...stat.out) //when using array
                data =`,{"${chunk.time_period}":${JSON.stringify({u:chunk.u,v:chunk.v})}`
                di = stat.di
                dj = stat.dj
                dc = dc + stat.gap
                gridx = stat.cx
                gridy = stat.cy
              } else {
                if (dp === 0) {
                  data =`},{"${chunk.time_period}":${JSON.stringify({u:chunk.u,v:chunk.v})}`
                } else {
                  data =`,"${chunk.time_period}":${JSON.stringify({u:chunk.u,v:chunk.v})}`
                }
               /*di = di + 1
                dc = dc + 1
                gridx = gridx + dx*/
              }
              dp = dp + 1
            } else {
              data =`,${JSON.stringify(chunk)}`;
            }
          }
          count++
        /*if (count % 999 === 0) { //debug
            fastify.log.info("--!!Count: " + count)
            fastify.log.info("------!!Data: " + data)
          }*/
          res.raw.write(data) //fastJson(sadcpSchema)(data)))
          cacheout.push(data)
        })
        src.on('error', () => {
          fastify.log.info("------!!Stream Error!!-------")
          //reject
        })
        src.on('end', () => {
          if (format === 'geojson') {
            res.raw.write(`]}`)
            cacheout.push(`]}`)
          } else if (keyx === 'sadcp' && format === 'uvgrid') {
            res.raw.write(`}]}`)
            cacheout.push(`}]}`)
          } else {
            res.raw.write(`]`)
            cacheout.push(`]`)
          } //'end' event will before 'finish'
          cacheout.push(null)
        //fastify.log.info("Now Set cache with data length: " + cacheout.length)
        /*const cachers = new Readable({
            objectMode: true,
            //encoding: 'utf8',
            read() {
              const item = cacheout.shift()
              if (!item) {
                this.push(null)
                return
              }
              this.push(item)
            }
          }) */
          cacheout.pipe(streamCache.set(qkey)) //.on('error', err => {
          //  fastify.log.info("Set cache error: " + err)
          //})
          fastify.log.info("------!!Stream End with cache set!! " + qkey)
        })
        src.on('finish', () => { //'end'
          //res.raw.write(']')
          fastify.log.info("------!!Stream finish!!-------")
          res.raw.end()  //https://stackoverflow.com/questions/70389882/nodejs-stream-returns-incomplete-response
          reply.hijack() //deprecated: res.sent = true
          resolve
        })
        //res.send(src.pipe(stringify()))
      })
    } // end of pipex

    const stream = sqldb //.raw(qry0 + qry1 + qry2).stream()
                     .raw(qry).stream({ objectMode: true })
    stream._read = ()=>{}
    //reply.header('Content-Type', 'application/stream+json')
    //reply.type('application/json')
    await pipex(stream, reply)
    //https://www.mariokandut.com/how-to-handle-streams-errors-in-node-js/
    //but not for sure it works or not??
    async function run_fs() {
      await finished(stream);
      fastify.log.info('Stream is done reading...');
    }
    run_fs().catch(fastify.log.error);

    next()
    } //end of not-cached else
  }

  fastify.route({
    url: '/sadcp',
    method: ['GET'],
    schema: {
      description: 'ODB SADCP API',
      tags: ['SADCP'],
      querystring: {
        type: "object",
        properties: {
          lon0: { type: 'number' },
          lon1: { type: 'number' },
          lat0: { type: 'number' },
          lat1: { type: 'number' },
          dep0: { type: 'number' },
          dep1: { type: 'number' },
          dep_mode: { type: 'string'},
          mode: { type: 'string'},
          format: { type: 'string'},
          xorder: { type: 'integer'},
          yorder: { type: 'integer'},
          start: { type: 'string' },
          end: { type: 'string'},
          limit: { type: 'integer'},
          mean_threshold: { type: 'string'},
          append: { type: 'string', default: 'u,v',
                    description: `Output multi-variables by comma-separated string: "u,v,count"`}
        }
      },
/*    headers: { //S.object().prop('x-ocpu-cache', S.string()),
        type: 'object',
        properties: {
          'x-firefox-spdy': { type: 'string' },
          'x-ocpu-cache': { type: 'string' }
        }
      },*/
      response: {
        //S.object().prop(
        200: //{
          //type: 'object',
          //properties: { //https://bit.ly/3vVD0Zg : fast-json-stringify doesn't support oneOf as the root object
          //  response: sadcpSchema
          //}
          S.oneOf([sadcpJsonSchema, sadcpGJsonSchema])
        //) //}
      }
    },
/*
  fastify.get('/sadcp', {
    schema: {
      tags: ['SADCP'],
      query: {
          properties: {
            lon0: { type: 'number' },
            lon1: { type: 'number' },
            lat0: { type: 'number' },
            lat1: { type: 'number' },
            start: { type: 'string' },
            end: { type: 'string'},
            std: { type: 'string'},
            limit: { type: 'integer'},
            mode: { type: 'string'},
            format: { type: 'string'}
          }
      },
      response: {
        200:
        {
          type: 'array',
          items: {
            type: 'object',
            properties: sadcpSchema
          }
        }
      }
    }
  },*/
  handler: async (req, reply) => {
    //const qstr = req.query
    await queryPipe(req, reply, 'sadcp')
/*
    let qry0= `DECLARE @DT_START DATETIME;
DECLARE @DT_END DATETIME;
DECLARE @INT_LON0 INT;
DECLARE @INT_LON1 INT;
DECLARE @INT_LAT0 INT;
DECLARE @INT_LAT1 INT;
SET @DT_START = ${start};`

      let qry1
      if (end==="") {
        qry1='SET @DT_END = DATEADD(yyyy, -3, DATEADD(dd, 0, DATEADD(mm, DATEDIFF(mm,0,getdate())+1, 0)));'
      } else {
        qry1='SET @DT_END = ${end};'
      }
      let qry2=`SET @INT_LON0=${lon0};
SET @INT_LON1=${lon1};
SET @INT_LAT0=${lat0};
SET @INT_LAT1=${lat1};
use [${fastify.config.SQLDBNAME}] 
Select TOP 200 
longitude_degree as "longitude",
latitude_degree as "latitude",
convert(nchar(19),[GMT+8],126)as "datetime",
Depth as "depth",
u as "u",
v as "v",
direction as "direction",
speed as "speed" From ${fastify.config.TABLE_SADCP} Where [GMT+8] BETWEEN @DT_START AND @DT_END 
AND longitude_degree BETWEEN @INT_LON0 AND @INT_LON1 
AND latitude_degree BETWEEN @INT_LAT0 AND @INT_LAT1 
Order by [GMT+8],longitude_degree,latitude_degree
`*/
   //-- Old query 20220505 modified, changed to stored procedure
   //fastify.log.info("API Query sqldb: " + qry0 + qry1 + qry2)

/* ---- if use Sequelize ---------------------------------------
      const data= await sqldb.query(qry0 + qry1 + qry2, {
        //'SELECT TOP 2 longitude_degree as "longitude", latitude_degree as "latitude",' +
        //'convert(nchar(19),[GMT+8],126)as "datetime", Depth as "depth", u as "u", v as "v",' +
        //`direction as "direction", speed as "speed" From ${fastify.config.TABLE_SADCP}`, {
        model: sadcpMdl,
        mapToModel: true
      })
      reply.send(data)
    })
    const data= await sqldb.raw(qry0 + qry1 + qry2)
    reply.send(data)
    next() */

  //Use stream 202205
    //const toJson = new Transform({
    //objectMode: true, //https://github.com/knex/knex/issues/2440
      //transform(chunk, _, callback) {
      //  this.push(JSON.stringify(chunk))
      //  callback()
      //}
    //})
/*  NO-Stream mode, it works. */
  //const data = await sqldb.raw(qry)
  //reply.send(data)
  //next()
   } //else cached //added @hqjs/stream-buffer-cache 20220524
  })

/* CTD API START */
  fastify.route({
    url: '/ctd',
    method: ['GET'],
    schema: {
      description: 'ODB CTD API',
      tags: ['CTD'],
      querystring: {
        type: "object",
        properties: {
          lon0: { type: 'number' },
          lon1: { type: 'number' },
          lat0: { type: 'number' },
          lat1: { type: 'number' },
          dep0: { type: 'number' },
          dep1: { type: 'number' },
          dep_mode: { type: 'string'},
          mode: { type: 'string'},
          cruise: { type: 'string'},
          format: { type: 'string'},
          xorder: { type: 'integer'},
          yorder: { type: 'integer'},
          start: { type: 'string' },
          end: { type: 'string'},
          limit: { type: 'integer'},
          mean_threshold: { type: 'string'},
          append: { type: 'string', default: 'temperature',
                    description: `Output multi-variables by comma-separated string: "temperature,salinity,fluorescence,transmission,oxygen,count"`}
        }
      },
      response: {
        200:
          S.oneOf([ctdJsonSchema, ctdGJsonSchema])
      }
    },
    handler: async (req, reply) => {
      await queryPipe(req, reply, 'ctd')
    }
  })
/* CTD API END*/
}
