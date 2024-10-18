// modified from @hqjs/stream-buffer-cache: https://github.com/hqjs/stream-buffer-cache/blob/master/index.js
'use strict'
import fp from 'fastify-plugin'
//import LRUMap from 'lru-cache'
import  { Duplex, Readable } from 'node:stream';

function streamBufferCachePlugin (fastify, opts, done) {

const createReadMethod = (entry, state) => function() {
  if (state.alreadyRead < entry.available) {
    const { readableHighWaterMark } = this;
    const chunkSize = Math.min(readableHighWaterMark, entry.available - state.alreadyRead);
    const chunk = entry.buffer.slice(state.alreadyRead, state.alreadyRead + chunkSize);
    this.push(Buffer.from(chunk));
    state.alreadyRead += chunkSize;
    if (state.readAttempts > 0) state.readAttempts--;
  } else if (entry.complete) {
    this.push(null);
  } else {
    state.readAttempts++;
  }
};

const streamBufferCache = Cls => class extends Cls {
  set(key) {
    const state = {
      alreadyRead: 0,
      readAttempts: 0,
    };

    const entry = {
      available: 0,
      buffer: [],
      complete: false,
      stream: new Duplex({
        write(chunk, encoding, cb) {
          //fastify.log.info("StreamBufferCache Set " + encoding + " for chunk: " + chunk)
          const { byteLength } = chunk;
          for (const b of chunk) {
              entry.buffer.push(b);
          }
          entry.available += byteLength;
          if (state.readAttempts > 0) {
            entry.stream.push(chunk);
            state.alreadyRead += byteLength;
            state.readAttempts--;
          }
          return cb();
        },
      }),
    };

    entry.stream['_read'] = createReadMethod(entry, state);

    entry.stream.on('error', err => {
      fastify.log.info("StreamBufferCache Set error: " + err + " and delete key: " + key)
      this.delete(key);
      process.nextTick(() => entry.stream.removeAllListeners());
    });

    entry.stream.once('finish', () => {
      if (state.readAttempts > 0) entry.stream.push(null);
      entry.complete = true;
    });

    super.set(key, entry);

    return entry.stream;
  }

  get(key) {
    const entry = super.get(key);
    if (!entry) return undefined;

    const state = {
      alreadyRead: 0,
      readAttempts: 0,
    };

    const stream = new Readable;

    stream['_read'] = createReadMethod(entry, state);

    if (!entry.complete) {
      const onData = chunk => {
        //fastify.log.info("StreamBufferCache Get chunk: " + chunk)
        if (state.readAttempts > 0) {
          stream.push(chunk);
          state.alreadyRead += chunk.byteLength;
          state.readAttempts--;
        }
      };
      const onError = err => {
        fastify.log.info("StreamBufferCache Get error: " + err)
        stream.emit('error', err);
      };

      entry.stream.on('data', onData);

      entry.stream.on('error', onError);

      entry.stream.once('finish', () => {
        if (state.readAttempts > 0) stream.push(null);

        entry.stream.off('data', onData);
        entry.stream.off('error', onError);
      });
    }

    return stream;
  }
};
/*
const Cache = streamBufferCache(LRUMap)
const sbcache = new Cache(opts)
fastify.decorate('streamCache', sbcache)*/
fastify.decorate('streamBufferCache', streamBufferCache)
done()

}

export default fp(streamBufferCachePlugin, {
  name: 'stream-buffer-cache'
})


