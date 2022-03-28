import AutoLoad from 'fastify-autoload'
import Mongodb from 'fastify-mongodb'
//import Sensible from 'fastify-sensible'
//import UnderPressure from 'under-pressure'
import Cors from 'fastify-cors'
import Cookie from 'fastify-cookie'
import { join } from 'desm'

export default async function (fastify, opts) {
  fastify.decorate('conf', {
    node_env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    devTestPort: 3003,
    sessiondir: process.env.NODE_ENV === 'production'? '/session' : '/sessioninfo',
    //allowSrc: ['https://nodeeco.firebaseapp.com','https://odbsso.oc.ntu.edu.tw']
  })

/*fastify.register(Sensible)
  fastify.register(UnderPressure, {
    maxEventLoopDelay: 1000,
    maxHeapUsedBytes: 1000000000,
    maxRssBytes: 1000000000,
    maxEventLoopUtilization: 0.98
  })
*/
//const allowSrc = ['https://nodeeco.firebaseapp.com','https://odbsso.oc.ntu.edu.tw']
  fastify.register(Cors, { origin: false
/*  origin: ['*'], //'https://ecodata.odb.ntu.edu.tw', 'https://localhost:3000', 'https://nodeeco.firebaseapp.com','https://odbsso.oc.ntu.edu.tw'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'User-Agent',
      // user device headers
      'X-Device-Brand',
      'X-Device-Model',
      'X-Device-Platform',
      'X-Device-OS',
      'X-Device-Token',
      // client info headers
      'X-Client-AppVersion',
      'X-Client-AppId',
      'X-Client-Id',
      // test others
      'Origin', 'X-Requested-With', 'Accept',
      'Cross-Origin-Resource-Policy', 'Cross-Origin-Opener-Policy',
      'Access-Control-Allow-Origin', 'Access-Control-Allow-Headers',
      'X-Content-Type-Options', 'X-Frame-Options', 'X-UA-Compatible'
    ],
    credentials: true,*/
  /*function (instance) {
    return (req, callback) => {
      let corsOptions;
      const origin = req.headers.origin
      // do not include CORS headers for requests from localhost
      //const hostname = new URL(origin).hostname
      //if (hostname === "localhost"){
      //  corsOptions = { origin: false }
      //} else
      if (allowSrc.indexOf(origin) !== -1) {
        corsOptions = { origin: true }
      } else {
        corsOptions = { origin: false }
      }
      callback(null, corsOptions) // callback expects two parameters: error and options
    }*/
  })

  fastify.register(Cookie, {})

  fastify.register(Mongodb, {
      forceClose: true,
      url: fastify.config.MONGO_CONNECT,
      name: 'mongo1'
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
