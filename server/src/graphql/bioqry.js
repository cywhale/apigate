import { FormData } from 'formdata-node'
import fetch from 'node-fetch'

//export const autoPrefix = '/raw/bioqry'
//export default async function bioqry (fastify, opts, next) {
//https://stackoverflow.com/questions/10623798/how-do-i-read-the-contents-of-a-node-js-stream-into-a-string-variable
const streamToString = async (stream) => {
    const chunks = []

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }

    if (chunks.length == 1 && chunks[0].toString("utf-8").indexOf("Error") >= 0) {
      //fastify.log.info
      console.log("Warning: Not find in db with msg: " + chunks[0].toString("utf-8"))
      return null
    }
    return Buffer.concat(chunks).toString("utf-8")
}

const fetchBio = (spname, grid, url, user, host, db) => {
    //const url = `${fastify.config.BIOQRY_HOST}/${fastify.config.BIOQRY_BASE}/${fastify.config.BIOQRY_GETBIO}`
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
    //formData.append("value_unit", `\"perm3\"`) //occurrence, so don't care abundance
    formData.append("taxon_lvl", '\"species\"')  //restrict searching for species (e.g. not all copepods)
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
export default fetchBio
