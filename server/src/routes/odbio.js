import S from 'fluent-json-schema'

export const autoPrefix = '/api'

export default async function odbio (fastify, opts, next) {
//return general json
/*const occqry = `query ($sp: String!, $grid: Int) {
    occurmdl(sp: $sp, grid: $grid)
    {
      taxarec_id
      longitude
      latitude
      season
      show_name
      rank
      date
      depth
      mesh
      cite_ref
      cite_abbrev
    }
  }`*/
  const occqry = `query ($sp: String!, $grid: Int) {
    occurrence(sp: $sp, grid: $grid)
    {
      decimalLongitude
      decimalLatitude
      scientificName
      taxonRank
      minimumDepthInMeters
      measurementType
      measurementValue
      measurementUnit
      eventDate
      eventTime
      occurrenceID
      bibliographicCitation
    }
  }`

  const darwinCoreSchema = S.object()
    .id('#darwinoccjson')
    .description('Occurrence ok (in JSON)')
    .prop("data", S.object()
      .prop("occurrence", S.array().items(S.object()
        .prop("decimalLongitude", S.number())
        .prop("decimalLatitude", S.number())
        .prop("scientificName", S.string())
        .prop("taxonRank", S.string())
        .prop("minimumDepthInMeters", S.number().raw({ nullable: true }))
        .prop("measurementType", S.string())
        .prop("measurementValue", S.integer())
        .prop("measurementUnit", S.string())
        .prop("eventDate", S.string())
        .prop("eventTime", S.string())
        .prop("occurrenceID", S.string())
        .prop("bibliographicCitation", S.string())
    )))

  const nameSchemaObj = {
    type: 'object',
    properties: {
      name: { type: 'string',
              description: 'Scientific name (binomial)'
      }
    },
    required: ['name']
  }

  fastify.get('/occurrence/:name', {
    schema: {
      description: 'Occurrence records of species in ODB Bio-database',
      tags: ['Occurrence'],
      params: nameSchemaObj,
      querystring: {
        type: "object",
        properties: {
          grid: { type: 'integer',
                  description: '0 (default), 1, 2, 3: gridded in 0.25, 0.5, 1, 2 degree (optional)'
          }
        }
      },
      response: {
        200: darwinCoreSchema
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
    //fastify.log.info("Go to fetch: " + spname + " with gridded: " + gridx)
    return reply.graphql(occqry, null, {sp: spname, grid: gridx})
  })

  next()
}

