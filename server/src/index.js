'use strict'
import Fastify from 'fastify';
import { readFileSync } from 'fs'
import Env from '@fastify/env'
import S from 'fluent-json-schema'
import { join } from 'desm'
import srvapp from './srvapp.js'
import Swagger from '@fastify/swagger'
import SwaggerUI from '@fastify/swagger-ui'
import apiConf, { uiConf } from './config/swagger_config.js'

const configSecServ = async (certDir='config') => {
  const readCertFile = (filename) => {
    return readFileSync(join(import.meta.url, certDir, filename))
  }
  try {
    const [key, cert] = await Promise.all(
      [readCertFile('privkey.pem'), readCertFile('fullchain.pem')])
    return {key, cert, allowHTTP1: true}
  } catch (err) {
    console.log('Error: certifite failed. ' + err)
    process.exit(1)
  }
}

const startServer = async () => {
  const PORT = 3023
  const {key, cert, allowHTTP1} = await configSecServ()
  const fastify = Fastify({
      http2: true,
      trustProxy: true,
      https: {key, cert, allowHTTP1},
      requestTimeout: 5000,
      logger: true,
      ajv: { //https://github.com/fastify/fastify/issues/2841
        customOptions: {
          coerceTypes: 'array'
        }
      }
  })

  fastify.register(Env, {
    dotenv: {
      path: join(import.meta.url, 'config/.env'),
    },
    schema: S.object()
      .prop('SQLSERVER', S.string().required())
      .prop('SQLPORT', S.integer().required())
      .prop('SQLDBNAME', S.string().required())
      .prop('SQLUSER', S.string().required())
      .prop('SQLPASS', S.string().required())
      .prop('TABLE_CTD', S.string().required())
      .prop('TABLE_SADCP', S.string().required())
      .prop('DOMAIN', S.string().required())
      .prop('BIOQRY_HOST', S.string().required())
      .prop('BIOQRY_BASE', S.string().required())
      .prop('BIOQRY_GETBIO', S.string().required())
      .prop('BIOQRY_GETSCI', S.string().required())
      .prop('BIOUSER', S.string().required())
      .prop('BIODB_HOST', S.string().required())
      .prop('BIODB', S.string().required())
      .prop('FISHDB_HOST', S.string().required())
      .prop('FISHDB', S.string().required())
      .valueOf()
  }).ready((err) => {
    if (err) console.error(err)
  })

  await fastify.register(Swagger, apiConf)
  await fastify.register(SwaggerUI, uiConf)
  await fastify.register(srvapp)

  fastify.listen({ port: PORT }, function (err, address) {
    if (err) {
      fastify.log.error(err)
      process.exit(1)
    }
    //fastify.swagger()
    fastify.log.info(`server listening on ${address}`)
  })
}

startServer()

