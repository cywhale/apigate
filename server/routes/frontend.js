import Static from 'fastify-static'
import Helmet from 'fastify-helmet'
//import path from 'path';
import { join } from 'desm'

//const fs = require('fs');
//const PORT = process.env.PORT || 3000;
//const devTestPort = 3003; // need nginx pass proxy to separate server/client to test /sessioninfo
//export const autoPrefix = '/_app'

export default async function (fastify, opts) {
  const {
    COOKIE_SECRET,
  } = fastify.config

  const {
    verifyToken,
    setToken
    //csrfProtection //for onRequest, that every route being protected by our authorization logic
  } = fastify

  //fastify.addHook('onRequest', authorize)

  fastify.register(Helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          'https://eco.odb.ntu.edu.tw',
          'https://ecodata.odb.ntu.edu.tw',
          'https://odbsso.oc.ntu.edu.tw/',
          "'unsafe-eval'",
          'https://unpkg.com'
        ],
        frameSrc: [
          "'self'",
          'https://eco.odb.ntu.edu.tw',
          'https://ecodata.odb.ntu.edu.tw',
          'https://odbsso.oc.ntu.edu.tw/'
        ],
        connectSrc: [
          "'self'",
          'https://eco.odb.ntu.edu.tw',
          'https://ecodata.odb.ntu.edu.tw',
          'https://odbsso.oc.ntu.edu.tw/',
          'https://unpkg.com'
        ],
        imgSrc: ["'self'", "https:", "data:"],
        styleSrc: [
          "'self'",
          'https://eco.odb.ntu.edu.tw',
          "'unsafe-inline'",
          //'https://www.gstatic.com',
          //'https://fonts.googleapis.com',
          'https://unpkg.com'
        ]
      /*
        fontSrc: [
          "'self'"//,
          //'https://www.gstatic.com',
          //'https://fonts.gstatic.com',
          //'https://fonts.googleapis.com'
        ]*/
      }
    }
  })
/*
  try {
    await app.register(require('./layersearch'), { prefix: '/search/layers' })
  } catch (err) {
    app.log.info('Register route error: ' + err);
  }
*/
//fastify.get(url, opts={schema:{...}}, handler) ==> fastify.route({method:, url:, schemal:, handler:...})
//https://web.dev/codelab-text-compression-brotli
//try { await
  fastify.get('*.js', (req, res, next) => {
      if (req.header('Accept-Encoding').includes('br')) {
        req.url = req.url + '.br';
        console.log(req.header('Accept-Encoding Brotli'));
        res.set('Content-Encoding', 'br');
        res.set('Content-Type', 'application/javascript; charset=UTF-8');
      } else {
        req.url = req.url + '.gz';
        console.log(req.header('Accept-Encoding Gzip'));
        res.set('Content-Encoding', 'gzip');
        res.set('Content-Type', 'application/javascript; charset=UTF-8');
      }
      next();
  })
/*} catch (err) {
    app.log.info('Try .br, .gz got error: ' + err);
  }
*/
  if (fastify.conf.port !== fastify.conf.devTestPort) { // for testing
    //try { await
    fastify.register(Static, {
        root: join(import.meta.url, '../..', 'client/build'), //path.join(__dirname, '..', 'client/build'),
        prefix: '/',
        prefixAvoidTrailingSlash: true,
        list: true /*{ //true
          format: 'html',
          names: ['index', 'index.html', '/']
        }*/
    })
    /*} catch (err) {
      app.log.info('Try serve ui/build error: ' + err);
    }*/
  }

  //try { await
  fastify.post(fastify.conf.sessiondir + '/init', async (req, res) => {
      if (req.cookies.token) {
        let verifyInit = verifyToken(req, res, COOKIE_SECRET, 'initSession'); //sessionJwt.verifyToken

        if (verifyInit) {
          res.code(200).send({'success': 'Verified token already existed'}); //res.code(200).send
/*        if (!req.cookies.guest) {
          }*/
        } else {
          res.code(400).send({'fail': 'Init token fail with wrong existed client token'});
        }
      } else {
        //console.log("req.payload is: ", req.body);
        if (req.body.action === 'initSession') {
          setToken(req, res, COOKIE_SECRET, 'initSession'); //sessionJwt.setToken
        } else {
          res.code(400).send({'fail': 'Init token fail with wrong client action'});
        }
      }
  })
  /*} catch (err) {
    app.log.info('Sent init cookie error' + err);
  }*/

  //try { await
  fastify.post(fastify.conf.sessiondir + '/login', async (req, res) => {
      if (req.cookies.token) {
        let verifyLogin = verifyToken(req, res, COOKIE_SECRET, 'initSession');

        if (verifyLogin) {
          if (!req.body.user) {
            res.code(400).send({'fail': 'Token ok but no user while login'});
          } else {
            res.code(200).send({'success': 'Token with user: ' + req.body.user});
            //sessionJwt.createToken(mySecret+req.body.user, )
          }
        } else {
          res.code(400).send({'fail': 'Token failed when login verified after init'});
        }

      } else {
        res.code(400).send({'fail': 'Need token in payload'})//);
      }
  })
  /*} catch (err) {
    app.log.info('Verify after login error' + err);
  }*/
/*
  const { db } = app.mongo.mongo1
  const layerprops = db.collection('layerprops')

  try {
    await app.get('/sessioninfo/search/:name', (req, res) => {
      console.log("req.param: ", req.params);
      layerprops.findOne(
        { value: req.params.name },
        onFind
      )
      async function onFind (err, layer) {
        await res.send(err || layer)
      }
    })
  } catch (err) {
    app.log.info('Search in mongo error' + err);
  }
*/
/*
  try {
    await app.addHook('onRequest', (req) => {
      //console.log("jwt verify: ", req);
      req.jwtVerify()
    });
  } catch {
    app.log.info('JWT verify error');
  }

  try {
    await app.get('/verifycookie', (req, res) => {
      //console.log("verify cookie:", req);
      res.send({ code: 'OK', message: 'it works!' })
    })
  } catch {
    app.log.info('Cookie verify error');
  }
//old: separate routes in file when using mongoose
  try {
    await routes.forEach((route, index) => {
      app.route(route)
    });
  } catch {
    app.log.info('Try serve each route error');
  }
*/
}
