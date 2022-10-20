'use strict'
import fp from 'fastify-plugin'
import cache from 'mercurius-cache'

async function cacheHandler (fastify, opts) {
  fastify.register(cache, {
    policy: {
      Query: {
        occurrence: {
          ttl: 60 * 60 * 24,
          storage: { type: 'memory' }
        },
        taxonomy: {
          ttl: 60 * 60 * 24,
          storage: { type: 'memory' }
        }
      }
    },
    storage: {
      type: 'redis', options: { client: fastify.redis, invalidation: true }
    },
    onDedupe: function (type, fieldName) {
      fastify.log.info({ msg: 'deduping', type, fieldName })
    },
    onHit: function (type, fieldName) {
      fastify.log.info({ msg: 'hit from cache', type, fieldName })
    },
    onMiss: function (type, fieldName) {
      fastify.log.info({ msg: 'miss from cache', type, fieldName })
    },
    onSkip: function (type, fieldName) {
      fastify.log.info({ msg: 'skip cache', type, fieldName })
    },
    // caching stats
    logInterval: 300, //secs
    logReport: (report) => {
      fastify.log.info({ msg: 'cache stats' })
      console.table(report)
    }
  })
}

export default fp(cacheHandler, {
  name: 'mercurius-cache',
  dependencies: ['mercurius', 'redis']
})
