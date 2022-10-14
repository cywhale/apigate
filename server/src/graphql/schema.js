const schema = `
type Query {
     occurrence(sp: String!, grid: Int): [DarwinCore]
}

type TaxaData {
    show_name: String!,
    longitude: Float!,
    latitude: Float!,
    season: Int,
    rank: String,
    taxarec_id: Int,
    cast_id: Int,
    taxon_count: Float,
    mlength: Float,
    date: String,
    time: String,
    depth: Float,
    mesh: Int,
    cite_ref: String,
    cite_abbrev: String
}

type DarwinCore {
    decimalLongitude: Float!,
    decimalLatitude: Float!,
    scientificName: String!,
    taxonRank: String,
    minimumDepthInMeters: Float,
    measurementType: String,
    measurementValue: Int,
    measurementUnit: String,
    eventDate: String,
    eventTime: String,
    occurrenceID: String,
    bibliographicCitation: String
}
`
export default schema
