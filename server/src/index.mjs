'use strict'
import { readFileSync } from 'fs'
import { join } from 'desm'
import buildApp from './app.mjs'

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
  const port = Number(process.env.PORT || 3023)
  const tlsEnabled = process.env.APIGATE_TLS !== 'false'
  const transportOptions = tlsEnabled
    ? { http2: true, https: await configSecServ() }
    : {}
  const fastify = buildApp({ fastifyOptions: transportOptions })

  fastify.listen({ port }, function (err, address) {
    if (err) {
      fastify.log.error(err)
      process.exit(1)
    }
    //fastify.swagger()
    fastify.log.info(`server listening on ${address}`)
  })
}

startServer()
