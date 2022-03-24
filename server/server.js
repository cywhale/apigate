'use strict'
//v1.0.0 source: https://codesource.io/build-a-rest-service-with-fastify/
//v1.0.1 modified by cywhale, try a fastify-server with preact client
//v1.0.4 refer fastify-cli & fastify-example: https://github.com/delvedor/fastify-example
import Fastify from 'fastify'
import { readFileSync } from 'fs'
import Env from 'fastify-env'
import S from 'fluent-json-schema'
import { join } from 'desm'
import App from './app.js'

async function configSecServ(certDir='config') {
  const readCertFile = (filename) => {
    return readFileSync(join(import.meta.url, certDir, filename))
  }
  try {
    const [key, cert] = await Promise.all(
      [readCertFile('privkey.pem'), readCertFile('fullchain.pem')]
    )
    return {key, cert, allowHTTP1: true}
  } catch (err) {
    console.log('Error: certifite failed. ' + err);
    process.exit(1)
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
    dotenv: {
      path: join(import.meta.url, 'config' ,'.env'),
    //debug: true
    },
    schema: S.object()
      .prop('COOKIE_SECRET', S.string().required())
      .prop('MONGO_CONNECT', S.string().required())
      .valueOf()
  }).ready((err) => {
    if (err) console.error(err)
  })

  fastify.register(App)

  const start = async () => {
    try {
      await fastify.listen(PORT)
      fastify.log.info(`server listening on ${fastify.server.address().port}`)
    } catch (err) {
      fastify.log.error(err)
      process.exit(1)
    }
  }
  start()
}

startServer();
