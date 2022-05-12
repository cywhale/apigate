import Spkey from '../models/spkey_mongoose'
import S from 'fluent-json-schema'
//import { stringify } from 'JSONStream' //stringifyObject
//import { Readable } from 'node:stream' //Transform
//import fastJson from 'fast-json-stringify'
//import Sequelize from 'sequelize'
//import parser from 'stream-json'
//import streamArray from 'stream-json/streamers/StreamArray'
//import zlib from 'zlib';

export const autoPrefix = process.env.NODE_ENV === 'production'? '/api' : '/apitest'

export default async function apirest (fastify, opts, next) {

    fastify.get('/taxonomy', async (req, reply) => {
        const keyx = await Spkey
                           .aggregate([
                             { $match: {taxon: {"$ne": ""}, unikey: {"$regex": /^(?!00a_genus).*/i}} },
                             { $group: {
                                   _id: {
                                     family: "$family",
                                     genus: "$genus"
                                   },
                                   children: { $addToSet: {
                                     taxon: "$taxon"
                                   } },
                             } },
                             { $unwind: "$children"}, //Need to re-sort taxon
                             { $sort: {"children.taxon":1} },
                             { $group: {
                                   _id: {
                                     family: "$_id.family",
                                     genus: "$_id.genus"
                                   },
                                   children: { $push: {
                                     taxon: "$children.taxon"
                                   } }
                             } },
                             { $sort: {"_id.genus":1} },
                             { $group: {
                                   _id:"$_id.family",
                                   taxon: { $push: {
                                       genus: "$_id.genus",
                                       species: "$children.taxon"
                                   } }
                             } },
                             { $project: {family:"$_id", _id:0, taxon:1} },
                             { $sort: {family:1} }
                           ]).exec()
        await reply.send(keyx)
    })

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

//ref: https://github.com/MatteoDiPaolo/googleTakeoutLocations-to-geoJson
  const toGeoJsonRow = row => {
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
            datetime: row.datetime,
            depth: row.depth || null,
            u: row.u || null,
            v: row.v || null,
            direction: row.direction || null,
            speed: row.speed || null
        }
    }
  }

  const { sqldb } = fastify
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
    .prop('longitude', S.number())
    .prop('latitude', S.number())
    .prop('datetime', S.string())
    .prop('depth', S.number())
    .prop('u', S.number())
    .prop('v', S.number())
    .prop('direction', S.number())
    .prop('speed', S.number())
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
    .prop('type', S.string())
    .prop('geometry', S.object()
        .prop('type', S.string())
        .prop('coordinates', S.array().minItems(2).items(S.number())))
    .prop('properties', S.object()
        .prop('datetime', S.string())
        .prop('depth', S.number())
        .prop('u', S.number())
        .prop('v', S.number())
        .prop('direction', S.number())
        .prop('speed', S.number()))
/*{
    $type: { type: 'string' },
    geometry: {
        $type: { type: 'string' },
        coordinates: { type: 'array' }
    },
    properties: {
        datetime: { type: 'string' },
        depth: { type: 'number' },
        u: { type: 'number' },
        v: { type: 'number' },
        direction: { type: 'number' },
        speed: { type: 'number' }
    }
  }*/
/*const sadcpSchema = {
    oneOf: [
      { $id: '#sadcpjson', type: 'object', properties: sadcpJsonSchema }, //, required: ['datetime'] },
      { $id: '#sadcpgjson', type: 'object', properties: sadcpGJsonSchema } //, required: ['topic'] },
    ]
  }*/
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
  fastify.route({
    url: '/sadcp',
    method: ['GET'],
    schema: {
      querystring: {
          lon0: { type: 'number' },
          lon1: { type: 'number' },
          lat0: { type: 'number' },
          lat1: { type: 'number' },
          start: { type: 'string' },
          end: { type: 'string'},
          std: { type: 'string'},
          limit: { type: 'integer'},
          mode: { type: 'string'},
          format: { type: 'string'},
          output: { type: 'string'}
      },
      response: {
        200: //{
          //type: 'object',
          //properties: { //https://bit.ly/3vVD0Zg : fast-json-stringify doesn't support oneOf as the root object
          //  response: sadcpSchema
          //}
          S.oneOf([sadcpGJsonSchema, sadcpJsonSchema])
        //}
      }
    },
/*
  fastify.get('/sadcp', {
    schema: {
      tags: ['sadcp'],
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
            format: { type: 'string'},
            output: { type: 'string'}
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
    //fastify.log.info("APITEST: " + JSON.stringify(req.query))
      const qstr = req.query
      let start='1991-01-01'
      if (typeof qstr.start !== 'undefined') {
        if (/^\d+\.?\d*$/.test(qstr.start) && qstr.start.length===8) {
          start = qstr.start.substring(0, 4) + '-' + qstr.start.substring(4, 6) + '-' + qstr.start.substring(6)
          start = `"${start}"`
        }
      }
      let end = 'NULL' //'' before modifed query to stored procedure in mssql 20220505
      if (typeof qstr.end !== 'undefined') {
        if (/^\d+\.?\d*$/.test(qstr.end) && qstr.end.length===8) {
          end = qstr.end.substring(0, 4) + '-' + qstr.end.substring(4, 6) + '-' + qstr.end.substring(6)
          end = `"${end}"`
        }
      }
      let limit = 'NULL'
      if (typeof qstr.limit !== 'undefined') {
        if (Number.isInteger(Number(qstr.limit)) && Number(qstr.limit) > 0) {
          limit = parseInt(qstr.limit)
        }
      }

      let lon0 = qstr.lon0??105
      let lon1 = qstr.lon1??135
      let lat0 = qstr.lat0??2
      let lat1 = qstr.lat1??35
      let std = (qstr.std??'').toLowerCase() //'woa13': `dbo.NODC_Standard_depths_woa13 group by depth`
      let mode = (qstr.mode??'average').toLowerCase() //'raw', may transfer huge data
      let format = (qstr.format??'geojson').toLowerCase() //'json'
      let output = (qstr.output??'').toLowerCase()    //'file', file output (not yet)
      let qry=`USE [${fastify.config.SQLDBNAME}];
      EXEC [dbo].[sadcpqry] @lon0=${lon0}, @lon1=${lon1}, @lat0=${lat0}, @lat1=${lat1}, @start=${start}, @end=${end}, @limit=${limit};`
    //fastify.log.info("Query is: " + qry)
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
    var count = 0;
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
          if (format === 'geojson') {
            data = JSON.stringify(toGeoJsonRow(chunk))
          } else {
            data = JSON.stringify(chunk)
          }
          if (count === 0) {
            if (format === 'geojson') {
              res.raw.write(`{"type":"FeatureCollection","features": [`)
              data = JSON.stringify(toGeoJsonRow(chunk))
            } else {
              res.raw.write(`[`)
              data = JSON.stringify(chunk)
            }
          } else {
            if (format === 'geojson') {
              data =`,${JSON.stringify(toGeoJsonRow(chunk))}`;
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
        })
        src.on('error', () => {
          fastify.log.info("------!!Stream Error!!-------")
          //reject
        })
        src.on('end', () => {
          if (format === 'geojson') {
            res.raw.write(`]}`)
          } else {
            res.raw.write(`]`)
          } //'end' event will before 'finish'
          //fastify.log.info("------!!Stream End!!-------")
        })
        src.on('finish', () => { //'end'
          //res.raw.write(']')
          fastify.log.info("------!!Stream finish!!-------")
          res.raw.end() //https://stackoverflow.com/questions/70389882/nodejs-stream-returns-incomplete-response
          res.sent = true
          resolve
        })
        //res.send(src.pipe(stringify()))
      })
    }

    const stream = sqldb //.raw(qry0 + qry1 + qry2).stream()
                     .raw(qry).stream({ objectMode: true })
    stream._read = ()=>{}
    //reply.header('Content-Type', 'application/stream+json')
    reply.type('application/json')
    await pipex(stream, reply)
  /*req.on('close', () => {
      stream.end();
      //stream.destroy();
      fastify.log.info("------!!Stream input close!!-------");
    })*/
/*  NO-Stream mode, it works. */
  //const data = await sqldb.raw(qry)
  //reply.send(data)
    next()
  }
  })
}
