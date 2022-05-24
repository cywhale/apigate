'use strict'
import fp from 'fastify-plugin'
import LRUMap from 'lru-cache'
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
