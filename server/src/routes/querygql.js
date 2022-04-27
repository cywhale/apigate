//import S from 'fluent-json-schema'
export const autoPrefix = process.env.NODE_ENV === 'production'? '/species' : '/specieskey'
//import Spkey from '../models/spkey_mongoose'; //change to use graphql by mercurius
//import fp from 'fastify-plugin'

export default async function querygql (fastify, opts, next) {
  //const { db } = fastify.mongo.mongo1;
  //const spkey = db.collection('spkey');
  //fastify.decorate('spkey', spkey);
    const def_pageSize = 30
    const infqry = `query ($taxon: String!, $keystr: Boolean, $mode: String, $first: Int, $last: Int, $after: String, $before: String, $key: String) {
                    infq(taxon: $taxon, keystr: $keystr, mode: $mode, first: $first, last: $last, after: $after, before: $before, key: $key)
              {
                totalCount
                pageInfo {
                  num
                  hasNextPage
                  hasPreviousPage
                }
                edges {
                  node {
                    ctxt
                  }
                  cursor
                  endCursor
                }
              }
    }`
    const taxonqry = `query {
                        taxontree {
                          children {
                            label
                            value
                            children {
                              label
                              value
                            }
                          }
                          label
                          value
                        }
                      }`
    //can add { taxonarr isAnyTaxon } in schema to test old top2bottom
    const ktreeqry =`query($sp: String!) {
      keytree(sp: $sp)
      {
        _id
        unikey
        pkey
        taxon
        ctxt
        sex
        children {
          unikey
          pkey
          taxon
          level
          type
          ctxt
          sex
          children {
            unikey
            pkey
            taxon
            level
            type
            ctxt
            sex
            children {
              unikey
              pkey
              taxon
              level
              type
              ctxt
              sex
              children {
                unikey
                pkey
                taxon
                level
                type
                ctxt
                sex
                children {
                  unikey
                  pkey
                  taxon
                  level
                  type
                  ctxt
                  sex
                  children {
                    unikey
                    pkey
                    taxon
                    level
                    type
                    ctxt
                    sex
                    children {
                      unikey
                      pkey
                      taxon
                      level
                      type
                      ctxt
                      sex
                      children {
                        unikey
                        pkey
                        taxon
                        level
                        type
                        ctxt
                        sex
                        children {
                          unikey
                          pkey
                          taxon
                          level
                          type
                          ctxt
                          sex
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`
    const pageSchema = {
              taxon: { type: 'string' },
              keystr:{ type: 'boolean'},
              mode: { type: 'string' },
              first: { type: 'number' },
              last: { type: 'number' },
              after: { type: 'string' },
              last: { type: 'string' },
              key: { type: 'string' },
              //ctxt: { type: 'string' }
            }; // if not use graphql
    fastify.route({ //.get('/page', (req, reply) => {
      method: ['GET', 'POST'],
      url: '/page',
      schema: pageSchema,
      handler: (req, reply) => {
    /*const get_parx = (qstr) => {
          let withq = qstr.indexOf('?');
          if (withq>=0) {
            return qstr.substring(qstr.indexOf('?')).replace('?', '').split('&').reduce((r,e) => (r[e.split('=')[0]] = decodeURIComponent(e.split('=')[1]).replace(/\s/g, "\\\s"), r), {});
          }
          return decodeURIComponent(qstr).replace(/\s/g, "\\\s")
      }
    */
        let parm
        let kobj={}
        //req.log.info("Query method: " + req.method)
        if (req.method==='POST') {
          parm = req.body
        } else {
          parm = req.query
        }
      //let parm = get_parx(req.query)
      //if (parm != null && parm.constructor.name === "Object") {
        //if (typeof parm.taxon !== 'undefined') {
        kobj["taxon"] = parm.taxon??'' //}
        kobj["keystr"] = parm.keystr? true: false
        kobj["mode"] = parm.mode??'all'
        if (typeof parm.first !== 'undefined') { kobj["first"] = parseInt(parm.first) }
        if (typeof parm.last !== 'undefined')  { kobj["last"] = parseInt(parm.last) }
        if (typeof parm.after !== 'undefined') { kobj["after"] = parm.after }
        if (typeof parm.before !== 'undefined'){ kobj["before"] = parm.before }
        if (typeof parm.key !== 'undefined'){ kobj["key"] = parm.key }
      //}
        if (kobj !== {}) {
          return reply.graphql(infqry, null, kobj)
        } else {
          return //{}
        }
      }
    })

    fastify.get('/', {
      schema: {
        query: {
          //$id: 'common_schema',
          properties: {
            taxon: {
              type: 'string'
            },
            key: {
              type: 'string'
            }/*,
            page: { type: 'number' },
            fig_only: {
              type: 'boolean'
            }*/
          }
        }
      }
    },(req, reply) => {
      const qstr = req.query
      if (typeof qstr.taxontree !== 'undefined') {
        return reply.graphql(taxonqry, null, {})
      }

      if (typeof qstr.query === 'undefined') return

      let kobj = {}
      kobj["taxon"] = qstr.query??''
      kobj["keystr"] = qstr.keystr? true : false
      kobj["mode"] = qstr.mode??'all'
      //if (qstr.key && qstr.key !== ''){ kobj["key"] = qstr.key }
      kobj["first"] = qstr.limit??def_pageSize
      //req.log.info("Query use graphql with taxon, key: " + kobj.taxon + kobj.key)
      //if (!isNaN(pg)) {
      //pqry = `query ($pg: Int!) { page(p: $pg) {ctxt} }`
      return reply.graphql(infqry, null, kobj)
    })

    fastify.get('/:name', /*{ //if not use graphql
      schema: {
        tags: ['spkey'],
        response: {
          200: {
              type: 'array',
              items: {
                type: 'object',
                properties: spkeySchema
            }
          }
        }
      }
    },*/
    (req, reply) => {
      //let sp = decodeURIComponent(req.params.name).replace(/\s/g, "\\\s") //if not use graphql
      //fastify.log.info("To find sp: " + sp)
      /*Spkey.find({$or:[
        {taxon: {$regex: sp, $options: "ix"} },
        {genus: {$regex: sp, $options: "ix"} },
        {family: {$regex: sp, $options: "ix"} },
        {fullname: {$regex: sp, $options: "ix"} }
        ]},
      //).toArray(async (err, key) => { //if use fastify-mongodb
      async (err, key) => {
        if (err) {
          req.log.info("Error when searching in Mongo: ", err);
          await reply.send({});
        } else {
          //await reply.send(key); // if use fastify-mongodb
          await reply.send([...key]); // use mongoose
        }
      })*/
      let name = decodeURIComponent(req.params.name)
      //if (name==="init") {
      //  return reply.graphql('{ init {ctxt} }')
      //}
/* for test
      const kqry = `query ($sp: String!) { keys(sp: $sp) {
                        unikey
                        pkey
                        genus
                        taxon
                        sex
                        type} }` //{unikey ctxt}
      return reply.graphql(kqry, null, {sp: name})
*/
      //req.log.info("Query use graphql: "+ query + " with sp: " + name)
      //return reply.graphql(infqry, null, {taxon: name, keystr: false, mode: 'all', first: def_pageSize}) //20220413 modified to KeyTree
      return reply.graphql(ktreeqry, null, {sp: name})
    })

    fastify.post('/keytree',
      (req, reply) => {
        let parm = req.body
        let taxon = parm.taxon??''

        if (taxon !== "" && taxon.toLowerCase() !== "all") {
          return reply.graphql(ktreeqry, null, {sp: decodeURIComponent(taxon)})
        } else {
          return
        }
    })

  next()
}
/*
export default fp(querygql, {
  name: 'querygql'
})
*/


