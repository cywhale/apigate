'use strict'
import fp from 'fastify-plugin'
import knex from 'knex';

function knexPlugin (fastify, opts, next) {
  const sopts = {...opts.knexOptions}
  if (!fastify.knex) {
    const kconn = knex(sopts)
    fastify.decorate('sqldb', kconn)
  }

  fastify.addHook('onClose', (instance, done) => {
    const { sqldb } = instance
    sqldb.destroy(() => instance.log.info({actor: 'Knex'}, 'Exit and pool closed.'))
  })

  next()
}

export default fp(knexPlugin, {
  name: 'knex'
})
