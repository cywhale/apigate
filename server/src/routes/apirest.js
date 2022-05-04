import Spkey from '../models/spkey_mongoose'
import { stringify } from 'JSONStream' //stringifyObject
//import { Transform } from 'stream'
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
  const sadcpSchema = {
          longitude: { type: 'number' },
          latitude: { type: 'number' },
          datetime: { type: 'string' },
          depth: { type: 'integer' },
          u: { type: 'number' },
          v: { type: 'number' },
          direction: { type: 'number' },
          speed: { type: 'number' }
  }

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
            end: { type: 'string'}
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
  },
  async (req, reply) => {
      //fastify.log.info("APITEST: " + JSON.stringify(req.query))
      const qstr = req.query
      let start='1991/01/01'
      if (typeof qstr.start !== 'undefined') {
        if (/^\d+\.?\d*$/.test(qstr.start) && qstr.start.length===8) {
          start = qstr.start.substring(0, 4) + '/' + qstr.start.substring(4, 6) + '/' + qstr.start.substring(6)
        }
      }
      let end=''
      if (typeof qstr.end !== 'undefined') {
        if (/^\d+\.?\d*$/.test(qstr.end) && qstr.end.length===8) {
          end = qstr.end.substring(0, 4) + '/' + qstr.end.substring(4, 6) + '/' + qstr.end.substring(6)
        }
      }
      let lon0 = qstr.lon0??105
      let lon1 = qstr.lon1??135
      let lat0 = qstr.lat0??2
      let lat1 = qstr.lat1??35

      let qry0= `DECLARE @DT_START DATETIME;
DECLARE @DT_END DATETIME;
DECLARE @INT_LON0 INT;
DECLARE @INT_LON1 INT;
DECLARE @INT_LAT0 INT;
DECLARE @INT_LAT1 INT;
SET @DT_START = '` + start + `';`

      let qry1
      if (end==="") {
        qry1='SET @DT_END = DATEADD(yyyy, -3, DATEADD(dd, 0, DATEADD(mm, DATEDIFF(mm,0,getdate())+1, 0)));'
      } else {
        qry1="SET @DT_END = '" + end + "';"
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
speed as "speed" From ${fastify.config.TABLE_SADCP} Where 1=1 
AND [GMT+8] BETWEEN @DT_START AND @DT_END 
AND longitude_degree BETWEEN @INT_LON0 AND @INT_LON1 
AND latitude_degree BETWEEN @INT_LAT0 AND @INT_LAT1 
Order by odb_cruise_id,[GMT+8],latitude_degree,longitude_degree,depth
`
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
    /*transform({ key, value }, _, callback) {
        if (key === 0) {
          callback(null, `${JSON.stringify(value)}`)
        } else {
          callback(null, ,${JSON.stringify(value)}`)
        }
      }*/
    //})
    const pipex = (src, res) => { //, opts = {end: false})
      return new Promise((resolve, reject) => {
        src //it works
        .pipe(stringify())
        .pipe(res.raw)
      /*src
        .pipe(zlib.createGunzip())
        .pipe(parser())
        .pipe(new streamArray())
        .on('data', data => res.raw.write(fastJson(sadcpSchema)(data)))*/
        src.on('error', reject)
        //stream.on('data', (data) => res.raw.write(fastJson(sadcpSchema)(data)))
        src.on('end', () => {
          //res.raw.write(']')
          //res.raw.end()
          resolve
        })
        //res.send(src.pipe(stringify()))
      })
    }
    const stream = sqldb.raw(qry0 + qry1 + qry2).stream()
    //reply.type('application/json')
    stream._read = ()=>{}
    await pipex(stream, reply)
    req.on('close', () => {
      stream.end();
      //stream.destroy();
    })
    next()
  })
}
