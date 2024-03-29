import fetchBio from './bioqry.mjs'
// UUID
// const UUID_namespace = '9b942cf6-0079-59d6-aed6-6ab4da6ac69e'
// https://codesandbox.io/s/test-uuid-wp4byf generated by uuid-by-string
// using getUuid("Ocean Data Bank(ODB), IONTU, Taiwan") and get UUID_namespace
/* gql/ query example:
query Q1($sp: String!){
  taxonomy(sp: $sp) {
    scientificName
    taxonRank
    specificEpithet
    genus
    family
  }
}
query Q2($sp: String!){
  occurrence(sp: $sp) {
    scientificName
    taxonRank
    decimalLongitude
    decimalLatitude
    eventDate
  }
}
variable: {"sp": "[\"Calanus sinicus\"]"}
*/
const toDarwinOccRow = row => {
  let dtime //Handle event and GMT+8 problem
  if (row.time && !isNaN(Date.parse(`${row.date} ${row.time}`))) {
    dtime = new Date(+new Date(`${row.date} ${row.time}`) + 8 * 3600 * 1000).toISOString()
  } else if (row.time && !isNaN(Number(row.time))) {
    if (row.time.length != 4 && row.time.length != 6) {
      dtime = new Date(+new Date(`${row.date}`) + 8 * 3600 * 1000).toISOString()
    } else {
      let ms
      if (row.time.length == 4) {
        ms = row.time.substring(0,2) + ':' + row.time.substring(2) + ':00'
      } else { //if (row.time.length == 6) {
        ms = row.time.substring(0,2) + ':' + row.time.substring(2,4) + ':' + row.time.substring(4)
      }
      if (isNaN(Date.parse(`${row.date} ${ms}`))) {
        dtime = new Date(+new Date(`${row.date}`) + 8 * 3600 * 1000).toISOString()
      } else {
        dtime = new Date(+new Date(`${row.date} ${ms}`) + 8 * 3600 * 1000).toISOString()
      }
    }
  } else {
    dtime = new Date(+new Date(`${row.date}`) + 8 * 3600 * 1000).toISOString()
  }

  return {
    decimalLongitude: row.longitude,
    decimalLatitude: row.latitude,
    scientificName: row.show_name,
    taxonRank: row.rank,
    minimumDepthInMeters: isNaN(Number(row.depth))? null: Number(row.depth),
    measurementType: 'Net mesh size',
    measurementValue: Number(row.mesh),
    measurementUnit: 'um',
    eventDate: dtime,
    //eventTime: `${row.time}Z`, //may undefined or wrong format e.g. (2215 => 22:15:00)
    occurrenceID: `TW:ODB:bio:${row.taxarec_id.toString()}`,
    bibliographicCitation: row.cite_ref
  }
}

const toDarwinTaxonRow = row => {
    return {
      scientificName: row.taxon,
      taxonRank: row.rank,
      kingdom: row.kingdom?? null,
      phylum: row.phylum?? null,
      class: row.class?? null,
      order: row.order?? null,
      family: row.family?? null,
      genus: row.genus?? null,
      specificEpithet: row.species? row.species.replace(new RegExp(`${row.genus} `, 'ig'), ''): null
    }
}

const resolvers = {
  Query: {
    //test: async (_, { x, y }) => x + y,
    occurrence: async (_, obj, ctx) => {
      const { sp, grid } = obj
      const url = `${ctx.app.config.BIOQRY_HOST}/${ctx.app.config.BIOQRY_BASE}/${ctx.app.config.BIOQRY_GETBIO}`
      //ctx.app.log.info("Fetch URL: " + url)
      let reqArr = [
            fetchBio(sp, url, ctx.app.config.BIOUSER, ctx.app.config.BIODB_HOST, ctx.app.config.BIODB, grid, true, true),
            fetchBio(sp, url, ctx.app.config.BIOUSER, ctx.app.config.FISHDB_HOST,ctx.app.config.FISHDB,grid, true, true)
          ]
      const data = await Promise.all(reqArr)
      let jdt = data.filter(x => x !== null).join(',').replace(/[\r\n]/gm, '').replace(/\],\[/gm, ',')
      //ctx.app.log.info("Data: " + jdt)
      let chunks = []
      let dt = JSON.parse(jdt)
      for (const chunk of dt) {
        //ctx.app.log.info("date, time: " + chunk.date + ", " + chunk.time + " to ISO: " +
                     //(chunk.time && chunk.time.indexOf(":") == 2? "TRUE": "FALSE") + " as: " )
                     //(new Date(`${chunk.date} ${chunk.time}`).toISOString()??"Wrong") +
                     //(new Date(`${chunk.date}`).toISOString()??"Wrong")) //chunk.time has wrong format e.g 2215 (22:15:00)
        chunks.push(toDarwinOccRow(chunk))
      }

      return chunks
    },

    taxonomy: async (_, obj, ctx) => {
      const { sp } = obj
      const url = `${ctx.app.config.BIOQRY_HOST}/${ctx.app.config.BIOQRY_BASE}/${ctx.app.config.BIOQRY_GETSCI}`
      const data = await fetchBio(sp, url, ctx.app.config.BIOUSER, ctx.app.config.BIODB_HOST, ctx.app.config.BIODB, -1, false, false)
      let jdt = data.replace(/[\r\n]/gm, '')
      //ctx.app.log.info("Data: "+jdt)
      let dt = JSON.parse(jdt)
      let chunks = []
      for (const chunk of dt) {
        chunks.push(toDarwinTaxonRow(chunk))
      }

      return chunks
    }
  }
}
export default resolvers
