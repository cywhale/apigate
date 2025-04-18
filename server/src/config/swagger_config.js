'use strict'
//import fp from 'fastify-plugin'
//import Swagger from '@fastify/swagger'

//async function apiSwaggerConf(fastify, opts, done) {
const apiConf = {
//fastify.register(Swagger,  {
    //exposeRoute: true, //removed after swagger-ui indep of fastify/swagger
    hideUntagged: true,
    swagger: {
      info: {
        title: 'ODB Open API',
        description: '## CTD/SADCP API Manual\n' +
          '* This swagger-UI is just for trials of ODB Open API.\n' +
          '* Specify smaller longitude/latitude/depth range can get faster response.\n' +
          '* Directly using these APIs by HTTP GET method (shown in the block of Request URL) can be even much faster.\n' +
          '* Note that *this UI may get stuck if too much data being queryed.*\n' +
          '* 注意：此Swagger介面僅限用於API測試，請使用較小範圍的時間與空間參數。較大資料量有可能導致介面失聯而使網站運作異常。',
        version: '1.0.0'
      },
      //externalDocs: {
      //  url: 'https://swagger.io',
      //  description: 'Find more info here'
      //},
      host: 'ecodata.odb.ntu.edu.tw',
      schemes: ['https'],
      consumes: ['application/json'],
      produces: ['application/json'],
    },
//} //https://github.com/fastify/fastify-swagger/issues/191
}

export const uiConf = {
    routePrefix: '/api',
    staticCSP: true,
    transformStaticCSP: (header) => header,
    uiConfig: {
      validatorUrl: null,
      docExpansion: 'list', //'full'
      deepLinking: false
    }
}

export default apiConf
/*
export default fp(apiSwaggerConf, {
  name: 'apiSwagger'
})
*/

