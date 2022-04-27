'use strict'
import fp from 'fastify-plugin'
import cache from 'mercurius-cache'
//const { createStorage } = require('async-cache-dedupe')

async function cacheHandler (fastify, opts) {
  fastify.register(cache, {
    policy: {
      Query: {
        taxontree: true,
        infq: true
      }
    },
    ttl: 60 * 60 * 24,
    storage: {
      type: 'redis', options: { client: fastify.redis, invalidation: false }
/*  get: async function (key) {
        try {
          return JSON.parse(await fastify.redis.get(key))
        } catch (err) {
          fastify.log.error({ msg: 'error on get from redis', err, key })
        }
        return null
      },
      set: async function (key, value) {
        try {
          await fastify.redis.set(key, JSON.stringify(value), 'EX', ttl)
        } catch (err) {
          fastify.log.error({ msg: 'error on set into redis', err, key })
        }
      }*/ //before mercurius-cache version 0.11
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

  /* garbage collector
  let gcIntervalLazy, gcIntervalStrict
  let cursor = 0
  const storage = createStorage('redis', { client: fastify.redis, invalidation: true })

  fastify.addHook('onReady', async () => {
    gcIntervalLazy = setInterval(async () => {
      // note gc function does not throw on error
      fastify.log.info({ msg: 'running garbage collector (lazy)' })
      const report = await storage.gc('lazy', { lazy: { chunk: options.cache.gc.lazyChunk, cursor }})
      if (report.error) {
        fastify.log.error({ msg: 'error running gc', mode: 'lazy', report })
        return
      }
      fastify.log.info({ msg: 'gc report', mode: 'lazy', report })
      cursor = report.cursor
    }, options.cache.gc.lazyInterval).unref()

    gcIntervalStrict = setInterval(async () => {
      // note gc function does not throw on error
      fastify.log.info({ msg: 'running garbage collector (strict)' })
      const report = await storage.gc('strict', { chunk: options.cache.gc.chunk })
      if (report.error) {
        fastify.log.error({ msg: 'error running gc', mode: 'strict', report })
        return
      }
      fastify.log.info({ msg: 'gc report', mode: 'strict', report })
    }, options.cache.gc.strictInterval).unref()
  })

  fastify.addHook('onClose', async () => {
    clearInterval(gcIntervalLazy)
    clearInterval(gcIntervalStrict)
  })*/
}

export default fp(cacheHandler, {
  name: 'mercurius-cache',
  dependencies: ['mercurius', 'redis']
})
