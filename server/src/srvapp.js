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
            encrypt: false,
            trustServerCertificate: true,
            multipleStatements: true,
            validateBulkLoadParameters: false
          }
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
    } /*finally {
      fastify.close()
    }*/
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
