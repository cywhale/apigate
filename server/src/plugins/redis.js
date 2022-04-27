'use strict'
import fp from 'fastify-plugin'
import redis from 'fastify-redis'

async function redisClient(fastify, opts) {
  fastify.register(redis,  {
    host: '127.0.0.1',
    port: 6379,
  })
}


export default fp(redisClient, {
  name: 'redis'
})

