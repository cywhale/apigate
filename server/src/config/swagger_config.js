'use strict'
//import fp from 'fastify-plugin'
//import Swagger from '@fastify/swagger'

//async function apiSwaggerConf(fastify, opts, done) {
const apiConf = {
//fastify.register(Swagger,  {
    routePrefix: '/api',
    exposeRoute: true,
    swagger: {
      info: {
        title: 'Test API',
        description: 'APIGATE Manual',
        version: '1.0.0'
      },
      externalDocs: {
        url: 'https://swagger.io',
        description: 'Find more info here'
      },
      host: 'ecodata.odb.ntu.edu.tw',
      schemes: ['http'],
      consumes: ['application/json'],
      produces: ['application/json']
    }
//}
}
export default apiConf
/*
export default fp(apiSwaggerConf, {
  name: 'apiSwagger'
})
*/

