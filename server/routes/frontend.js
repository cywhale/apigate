import Static from 'fastify-static'
import Helmet from 'fastify-helmet'
//import path from 'path';
import { join } from 'desm'

export default async function (fastify, opts) {
  const {
    verifyToken,
    setToken
    //csrfProtection //for onRequest, that every route being protected by our authorization logic
  } = fastify

  const fopts = {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            fail: { type: 'string' }
          }
        }
      }
    }
  }
  const allowSrc = ['https://nodeeco.firebaseapp.com','https://odbsso.oc.ntu.edu.tw']

  fastify.register(Helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", "https:"],
        frameAncestors: allowSrc,
        frameSrc: allowSrc,
        scriptSrc: ["'self'", "https:", "'unsafe-eval'"],
        connectSrc: ["'self'", "https:"],
        imgSrc: ["'self'", "https:", "data:"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'"
        ]
      }
    }
  })

//fastify.get(url, opts={schema:{...}}, handler) ==> fastify.route({method:, url:, schemal:, handler:...})
//https://web.dev/codelab-text-compression-brotli
  fastify.get('*.(js|json)', fopts, (req, res, next) => {
      if (req.header('Accept-Encoding').includes('br')) {
        req.url = req.url + '.br'
      //console.log(req.header('Accept-Encoding Brotli'));
        res.header('Content-Encoding', 'br')
        res.header('Content-Type', 'application/javascript; charset=UTF-8')
      } else {
        req.url = req.url + '.gz'
      //console.log(req.header('Accept-Encoding Gzip'));
        res.header('Content-Encoding', 'gzip')
        res.header('Content-Type', 'application/javascript; charset=UTF-8')
      }
      next();
  })

  if (fastify.conf.port !== fastify.conf.devTestPort) { // for testing
    console.log("In prod mode with sessiondir ", fastify.conf.sessiondir)
    fastify.register(Static, {
        root: join(import.meta.url, '../..', 'client/build'), //path.join(__dirname, '..', 'client/build'),
        prefix: '/',
        prefixAvoidTrailingSlash: true,
/*        setHeaders: function (res, path, stat) {
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Origin, Cache-Control')
            res.setHeader('X-Content-Type-Options', 'nosniff')
            res.setHeader('X-Frame-Options', 'ALLOW-FROM https://get.google.com https://nodeeco.firebaseapp.com https://odbsso.oc.ntu.edu.tw')
            res.setHeader('X-UA-Compatible', 'ie=edge')
            res.setHeader('X-XSS-Protection', '1; mode=block')
            //res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
        },*/ // console.log(stat) } },
        list: true,
        cacheControl: true,
        maxAge: 31536000000 //in ms
    })
  } else {
    console.log("In dev mode with sessiondir ", fastify.conf.sessiondir)
  }

  fastify.post(fastify.conf.sessiondir + '/init', fopts, async (req, res) => {
      if (req.cookies.token) {
        let verifyInit = verifyToken(req, res, fastify.config.COOKIE_SECRET, 'initSession')
        if (verifyInit) {
          console.log("Verfiy ok: ", req.body.action)
          res.code(200).send({success: 'Verified token already existed'})
        } else {
          console.log("Verfiy fail: ", req.body.action)
          res.code(400).send({fail: 'Init token fail with wrong existed client token'})
        }
      } else {
        if (req.body.action === 'initSession') {
          console.log("Now req.body.action is ", req.body.action)
          setToken(req, res, fastify.config.COOKIE_SECRET, 'initSession')
        } else {
          res.code(400).send({fail: 'Init token fail with wrong client action'})
        }
      }
  })

  fastify.post(fastify.conf.sessiondir + '/login', fopts, async (req, res) => {
      if (req.cookies.token) {
        let verifyLogin = verifyToken(req, res, fastify.config.COOKIE_SECRET, 'initSession')

        if (verifyLogin) {
          if (!req.body.user) {
            res.code(400).send({fail: 'Token ok but no user while login'})
          } else {
            res.code(200).send({success: 'Token with user: ' + req.body.user})
          }
        } else {
          res.code(400).send({fail: 'Token failed when login verified after init'})
        }
      } else {
        res.code(400).send({fail: 'Need token in payload'})
      }
  })

  fastify.post(fastify.conf.sessiondir + '/verify', fopts, async (req, res) => {
      if (req.cookies.token) {
        let verifyLogin = verifyToken(req, res, fastify.config.COOKIE_SECRET, 'initSession');

        if (verifyLogin) {
          res.code(200).send({success: 'Verified with token.'});
        } else {
          res.code(400).send({fail: 'Token failed'});
        }
      } else {
        res.code(400).send({fail: 'Need token in payload'});
      }
  })
}
