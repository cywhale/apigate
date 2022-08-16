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
        title: 'ODB Test API',
        description: 'APIGATE Manual',
        version: '1.0.0'
      },
      //externalDocs: {
      //  url: 'https://swagger.io',
      //  description: 'Find more info here'
      //},
      host: 'ecodata.odb.ntu.edu.tw',
      schemes: ['https'],
      consumes: ['application/json'],
      produces: ['application/json']
    },
    uiConfig: {
      validatorUrl: null,
      docExpansion: 'full', //'sadcp'
      deepLinking: false
    }
//} //https://github.com/fastify/fastify-swagger/issues/191
}
export default apiConf
/*
export default fp(apiSwaggerConf, {
  name: 'apiSwagger'
})
*/

