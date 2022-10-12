import { FormData } from 'formdata-node'
import fetch from 'node-fetch'

export const autoPrefix = '/raw/bioqry'

export default async function bioqry (fastify, opts, next) {
//https://stackoverflow.com/questions/10623798/how-do-i-read-the-contents-of-a-node-js-stream-into-a-string-variable
  const streamToString = async (stream) => {
    const chunks = []

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }

    if (chunks.length == 1 && chunks[0].toString("utf-8").indexOf("Error") >= 0) {
      fastify.log.info("Warning: Not find in db with msg: " + chunks[0].toString("utf-8"))
      return null
    }
    return Buffer.concat(chunks).toString("utf-8")
  }

  const fetchBio = (spname, grid, user, host, db) => {
    const url = `${fastify.config.BIOQRY_HOST}/${fastify.config.BIOQRY_BASE}/${fastify.config.BIOQRY_GETBIO}`
    let formData = new FormData()
    formData.append("dbuser", `\"${user}\"`) //fastify.config.BIOUSER,
    formData.append("dbhost", `\"${host}\"`) //fastify.config.BIODB_HOST,
    formData.append("dbname", `\"${db}\"`)   //fastify.config.BIODB,
    formData.append("taxon", spname) //already pre-processed in fastify.get()
    if (grid > 3) {
      formData.append("grd_sel", 0)  //only 0, 1, 2, 3 (and -1)
    } else if (grid >= 0) {
      formData.append("grd_sel", grid) //if not append, i.e. pass NA to BioQuery
    }
    formData.append("value_unit", `\"perm3\"`)
    formData.append("appends", `\"all\"`)

    return fetch(url, {
        method: 'POST',
        mode: 'same-site',
        redirect: 'follow',
        //credentials: 'include',
        //withCredentials: true,
        //headers: new Headers(), //{ "Content-Type": "multipart/form-data" },
        //headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
        body: formData
        //JSON.stringify({dbuser: user, dbhost: host, dbname: db, taxon: spname, grd_sel: 0, value_unit: 'perm3', appends: 'all'})
      }).then(async (res) => {
         const data = await streamToString(res.body)
         return data
      })
  }

  const nameSchemaObj = {
    type: 'object',
    properties: {
      name: { type: 'string',
              description: 'Schema name (fuzzy match)'
      }
    },
    required: ['name']
  }

  fastify.get('/:name', {
    schema: {
      description: 'Launch BioQuery in ODB by scientific name',
      //tags: ['bioquery'], //hide untagged API in swagger
      params: nameSchemaObj,
      querystring: {
        type: "object",
        properties: {
          grid: { type: 'integer' }
        }
      }
    }
  }, async (req, reply) => {
    let spname = decodeURIComponent(req.params.name) // Sp A, Sp B, Sp C -> '[\"Sp A\",\"Sp B\",\"Sp C\"]'
    if (spname.indexOf(",") >= 0) {
      spname = `[\"` + spname.replace(/,\s*/g, `\",\"`) + `\"]`
    } else {
      spname = `\"${spname}\"`
    }
    let gridx = req.query.grid??0
    fastify.log.info("Go to fetch: " + spname + " with gridded: " + gridx)
    let dbtbl = ['bioDB', 'fishDB']
    let reqArr = [
    //const data = await
                  fetchBio(spname, gridx, fastify.config.BIOUSER, fastify.config.BIODB_HOST, fastify.config.BIODB),
                  fetchBio(spname, gridx, fastify.config.BIOUSER, fastify.config.FISHDB_HOST, fastify.config.FISHDB)
                 ]
    //return data
    const data = await Promise.all(reqArr)
    return data.filter(x => x !== null).join(',')
  })

  next()
}
