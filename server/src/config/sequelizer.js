'use strict'
import fp from 'fastify-plugin'
import Sequelize from 'sequelize';

function sequelizePlugin (fastify, opts, next) {
  const sopts = {...opts.sequelizeOptions}
  const sequelizeConn = new Sequelize(sopts.database, sopts.username, sopts.password, sopts.options)

  if (typeof opts.instance === 'string' && opts.instance) {
    fastify.decorate(opts.instance, sequelizeConn)
  } else {
    fastify.decorate('sqldb', sequelizeConn)
  }

  fastify.addHook(
    'onClose',
    (instance, done) => sequelizeConn.close().then(() => next())
  )
  next()
}

export default fp(sequelizePlugin, {
  name: 'sequelize'
})
