'use strict'
import Fastify from 'fastify';
import { readFileSync } from 'fs'
import Env from '@fastify/env'
import S from 'fluent-json-schema'
import { join } from 'desm'
import srvapp from './srvapp.js'
import Swagger from '@fastify/swagger'
import apiConf from './config/swagger_config.js'

const configSecServ = async (certDir='config') => {
  const readCertFile = (filename) => {
    return readFileSync(join(import.meta.url, certDir, filename)) //fs.readFileSync(path.join(__dirname, certDir, filename));
  };
  try {
    const [key, cert] = await Promise.all(
      [readCertFile('privkey.pem'), readCertFile('fullchain.pem')]);
    return {key, cert, allowHTTP1: true};
  } catch (err) {
    console.log('Error: certifite failed. ' + err);
    process.exit(1);
  }
}

const startServer = async () => {
  const PORT = process.env.PORT || 3000;
  const {key, cert, allowHTTP1} = await configSecServ()
  const fastify = Fastify({
      http2: true,
      trustProxy: true,
      https: {key, cert, allowHTTP1},
      requestTimeout: 5000,
      logger: true
  })

  fastify.register(Env, {
    //confKey: 'config',
    dotenv: {
      path: join(import.meta.url, 'config/.env'),
    //debug: true
    },
    schema: S.object()
      //.prop('NODE_ENV', S.string().required())
      .prop('COOKIE_SECRET', S.string().required())
      .prop('MONGO_CONNECT', S.string().required())
      .prop('SQLSERVER', S.string().required())
      .prop('SQLPORT', S.integer().required())
      .prop('SQLDBNAME', S.string().required())
      .prop('SQLUSER', S.string().required())
      .prop('SQLPASS', S.string().required())
      .prop('TABLE_CTD', S.string().required())
      .prop('TABLE_SADCP', S.string().required())
      .valueOf()
  }).ready((err) => {
    if (err) console.error(err) //console.log(fastify.config)
  })

  fastify.register(srvapp) //old: use fastify-mongodb, but not work used in graphql resolvers
  fastify.register(Swagger, apiConf)

  fastify.listen({ port: PORT }, function (err, address) {
    if (err) {
      fastify.log.error(err)
      process.exit(1)
    }
    fastify.swagger()
    fastify.log.info(`server listening on ${address}`)
  })
}

startServer()

