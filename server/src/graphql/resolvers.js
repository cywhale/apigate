import fetchBio from './bioqry'
// UUID
// const UUID_namespace = '9b942cf6-0079-59d6-aed6-6ab4da6ac69e'
// https://codesandbox.io/s/test-uuid-wp4byf generated by uuid-by-string
// using getUuid("Ocean Data Bank(ODB), IONTU, Taiwan") and get UUID_namespace
const toDarwinCoreRow = row => {
    return {
      decimalLongitude: row.longitude,
      decimalLatitude: row.latitude,
      scientificName: row.show_name,
      taxonRank: row.rank,
      minimumDepthInMeters: isNaN(Number(row.depth))? null: Number(row.depth),
      measurementType: 'Net mesh size',
      measurementValue: Number(row.mesh),
      measurementUnit: 'um',
      eventDate: row.date,
      eventTime: `${row.time}Z`,
      occurrenceID: `TW:ODB:bio:${row.taxarec_id.toString()}`,
      bibliographicCitation: row.cite_ref
    }
}

const resolvers = {
  Query: {
    occurrence: async (_, obj, ctx) => {
      const { sp, grid } = obj
      const url = `${ctx.app.config.BIOQRY_HOST}/${ctx.app.config.BIOQRY_BASE}/${ctx.app.config.BIOQRY_GETBIO}`
      ctx.app.log.info("Fetch URL: " + url)
      let reqArr = [
            fetchBio(sp, grid, url, ctx.app.config.BIOUSER, ctx.app.config.BIODB_HOST, ctx.app.config.BIODB),
            fetchBio(sp, grid, url, ctx.app.config.BIOUSER, ctx.app.config.FISHDB_HOST,ctx.app.config.FISHDB)
          ]
      const data = await Promise.all(reqArr)
      let jdt = data.filter(x => x !== null).join(',').replace(/[\r\n]/gm, '').replace(/\],\[/gm, ',')
      //ctx.app.log.info("Data: " + jdt)
      let chunks = []
      let dt = JSON.parse(jdt)
      for (const chunk of dt) {
        //ctx.app.log.info(chunk)
        chunks.push(toDarwinCoreRow(chunk))
      }

      return chunks
    }
  }
}
export default resolvers