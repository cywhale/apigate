'use strict'
import fp from 'fastify-plugin'
import { LRUCache as LRUMap } from 'lru-cache' //no default name before "lru-cache": 9.0.0, initially work at "^7.18.3"
//import streamBufferCache from '@hqjs/stream-buffer-cache';
//const Cache = streamBufferCache(LRUMap)

function streamCachePlugin (fastify, opts, next) {

  const { streamBufferCache } = fastify
  const Cache = streamBufferCache(LRUMap)

  //const sopts = {...opts.streamCacheOptions}
  const sbcache = new Cache(opts)
  fastify.decorate('streamCache', sbcache)
  next()
}

export default fp(streamCachePlugin, {
  name: 'streamCache'
})
