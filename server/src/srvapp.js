import AutoLoad from 'fastify-autoload'
import { join } from 'desm'
import mercurius from 'mercurius'
import db from './config/db'
import schema from './graphql/schema'
import resolvers from './graphql/resolvers'

export default async function (fastify, opts, next) {
  fastify.decorate('conf', {
    node_env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    devTestPort: 3003,
    sessiondir: process.env.NODE_ENV === 'production'? '/session' : '/sessioninfo'
  })

  fastify.register(db, { url: fastify.config.MONGO_CONNECT }) //use mongoose

  fastify.register(mercurius, {
        schema: schema,
        resolvers: resolvers,
        graphiql: true, //'playground', //has been removed from mercuius issue #453
        jit: 1,
        queryDepth: 11
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
      fastify.log.error({actor: 'Knex'}, 'Error: Register failed.' + err.messsage)
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
