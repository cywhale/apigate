'use strict'
import Fastify from 'fastify'
import Env from '@fastify/env'
import S from 'fluent-json-schema'
import { join } from 'desm'
import Swagger from '@fastify/swagger'
import SwaggerUI from '@fastify/swagger-ui'
import srvapp from './srvapp.mjs'
import apiConf, { uiConf } from './config/swagger_config.js'

const envSchema = S.object()
  .prop('SQLSERVER', S.string().required())
  .prop('SQLPORT', S.integer().required())
  .prop('SQLDBNAME', S.string().required())
  .prop('SQLUSER', S.string().required())
  .prop('SQLPASS', S.string().required())
  .prop('TABLE_CTD', S.string().required())
  .prop('TABLE_SADCP', S.string().required())
  .prop('DOMAIN', S.string().required())
  .valueOf()

export const defaultFastifyOptions = {
  trustProxy: true,
  requestTimeout: 5000,
  logger: true,
  ajv: {
    customOptions: {
      coerceTypes: 'array'
    }
  }
}

export default function buildApp (options = {}) {
  const {
    fastifyOptions = {},
    envData,
    envFile = join(import.meta.url, 'config/.env'),
    appOptions = {}
  } = options

  const fastify = Fastify({ ...defaultFastifyOptions, ...fastifyOptions })
  const envOptions = { schema: envSchema }

  if (envData) envOptions.data = envData
  else envOptions.dotenv = { path: envFile }

  fastify.register(Env, envOptions)
  fastify.register(Swagger, apiConf)
  fastify.register(SwaggerUI, uiConf)
  fastify.register(srvapp, appOptions)

  return fastify
}
