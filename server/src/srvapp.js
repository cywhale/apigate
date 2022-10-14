import AutoLoad from '@fastify/autoload'
import Cors from '@fastify/cors'
import { join } from 'desm'
import mercurius from 'mercurius'
import schema from './graphql/schema'
import resolvers from './graphql/resolvers'
import fs from 'fs'
import { Readable } from 'node:stream'

export default async function (fastify, opts, next) {
  fastify.decorate('conf', {
    node_env: process.env.NODE_ENV || 'development',
    port: 3023 //process.env.PORT || 3000,
  })

//fastify.register(db, { url: fastify.config.MONGO_CONNECT }) //use mongoose
  fastify.register(mercurius, {
        schema: schema,
        resolvers: resolvers,
        graphiql: true,
        jit: 1,
        //queryDepth: 11
  })

  fastify.register(import('./config/knexconn.js'), {
    knexOptions: {
      client: 'mssql',
      connection: {
        host: fastify.config.SQLSERVER,
        user: fastify.config.SQLUSER,
        password: fastify.config.SQLPASS,
        database: fastify.config.SQLDBNAME,
        port: fastify.config.SQLPORT,
        options: {
          cancelTimeout: 15000, //http://tediousjs.github.io/tedious/api-connection.html
          requestTimeout: 120000,
          connectTimeout: 20000,
          encrypt: false,
          trustServerCertificate: true,
          multipleStatements: true,
          validateBulkLoadParameters: false
        }
      },
      pool: {
        max: 15,
        min: 0
      }
    }
  }).ready(async () => {
    try { // first connection
      const { sqldb } = fastify
      fastify.log.info({actor: 'Knex'}, 'Connected to mssql database & first query trial...')
      // frist query, just a trial...
      sqldb.raw(
          'SELECT TOP 1 longitude_degree as "longitude", latitude_degree as "latitude",' +
          'convert(nchar(19),[GMT+8],126)as "datetime", Depth as "depth", u as "u", v as "v",' +
          `direction as "direction", speed as "speed" From ${fastify.config.TABLE_SADCP}`
      ).then(data => {
        fastify.log.info('Test first data' + JSON.stringify(data))
        next()
      })
    } catch(err) {
      fastify.log.error({actor: 'Knex'}, 'Error: Register failed.' + err)
      next()
    }
  })

  fastify.register(import('./config/streamBufferCache.js')) //, {
  fastify.register(import('./config/streamCache.js'), {
    max: 40000,
    ttl: 1000 * 60 * 60 * 72
  }).ready(async () => {
    try {
      const { streamCache } = fastify
      fastify.log.info({actor: 'streamBufferCache'}, 'Test key...')
      let test_key = [{"1":"start"},{"2":"ok"}]
      let testrs = //Readable.from(test_key)
          new Readable({
            objectMode: true,
            //encoding: 'utf8',
            read() {
              const item = JSON.stringify(test_key.shift()) //Buffer.from(test_key.shift(), 'utf8')
              if (!item) {
                this.push(null)
                return
              }
              this.push(item)
            }
          })
      //fs.createReadStream('./tests/test_key.json', { encoding: 'utf8' }).pipe(streamCache.set('test'));
      testrs.pipe(streamCache.set('test2'))
      if (streamCache.get('test2')) {
        fastify.log.info({actor: 'streamBufferCache'}, 'Cache Test Hit!! ' +
                         streamCache.max) // + " key: " + streamCache.keyList )
        streamCache.get('test2')
          .pipe(fs.createWriteStream('./tests/buffer-cache.js.test'))
      } else {
        fastify.log.info({actor: 'streamBufferCache'}, '!!Cache Test Miss')
      }
      next()
    } catch(err) {
      fastify.log.error({actor: 'streamBufferCache'}, 'Error: Register failed.' + err)
      next()
    }
  })

/* Sequelize works 202205... (but then try knex.js)
// commit:https://github.com/cywhale/apigate/commit/d4321bc6f03529bbd9eb335e2472c6f9c01077ff
  fastify.register(import('./config/sequelizer.js'), {
    instance: "sqldb",
    sequelizeOptions: {
      database: fastify.config.SQLDBNAME,
      username: fastify.config.SQLUSER,
      password: fastify.config.SQLPASS,
      options: {
        host: fastify.config.SQLSERVER,
        port: fastify.config.SQLPORT,
        dialect: 'mssql',
        dialectOptions: {
          options: {
            cancelTimeout: 15000, //http://tediousjs.github.io/tedious/api-connection.html
            requestTimeout: 120000,
            connectTimeout: 20000,
            encrypt: false,
            trustServerCertificate: true,
            multipleStatements: true,
            validateBulkLoadParameters: false
          }
        },
        pool: {
          max: 15,
          min: 0,
          acquire: 40000,
          idle: 20000
        },
        sync: { force: false }
      }
    }
  }).ready(async () => {
    try { // first connection
      const { sqldb } = fastify
      sqldb.authenticate()
      .then(() => {
        fastify.log.info({actor: 'Sequelize'}, 'Connected to mssql database & first query trial...')
        // frist query, just a trial...
        sqldb.query(
          'SELECT TOP 1 longitude_degree as "longitude", latitude_degree as "latitude",' +
          'convert(nchar(19),[GMT+8],126)as "datetime", Depth as "depth", u as "u", v as "v",' +
          `direction as "direction", speed as "speed" From ${fastify.config.TABLE_SADCP}`, {
          //model: sadcpMdl,
          mapToModel: false
        }).then(data => {
          fastify.log.info('Test first data' + JSON.stringify(data))
        })
        next()
      })
      .catch(err => {
        fastify.log.error({actor: 'Sequelize'}, 'Error: Authenticate failed.' + err.message)
        next()
      })
    } catch(err) {
      fastify.log.error({actor: 'Sequelize'}, 'Error: Register failed.' + err.messsage)
      next()
    } //finally {
      //fastify.close()
    //}
  }) */

  fastify.register(Cors, (instance) => {
    return (req, callback) => {
      const corsOptions = {
        origin: true,
        credentials: true,
        preflight: true,
        preflightContinue: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Keep-Alive', 'User-Agent',
                         'Cache-Control', 'Authorization', 'DNT', 'X-PINGOTHER', 'Range'],
        exposedHeaders: ['Content-Range'],
        maxAge: 86400,
      };
      // do not include CORS headers for requests from localhost
      if (/^localhost$/m.test(req.headers.origin)) {
        corsOptions.origin = false
      }
      callback(null, corsOptions)
    }
  })

  fastify.register(AutoLoad, {
    dir: join(import.meta.url, 'plugins'),
    options: Object.assign({}, opts)
  })

  fastify.register(AutoLoad, {
    dir: join(import.meta.url, 'routes'),
    dirNameRoutePrefix: false,
    options: Object.assign({}, opts)
  })
}
