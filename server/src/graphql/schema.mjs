const schema = `
type Query {
     occurrence(sp: String!, grid: Int): [DarwinOcc]
     taxonomy(sp: String!): [DarwinTaxon]
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

type DarwinOcc {
    decimalLongitude: Float!,
    decimalLatitude: Float!,
    scientificName: String!,
    taxonRank: String,
    minimumDepthInMeters: Float,
    measurementType: String,
    measurementValue: Int,
    measurementUnit: String,
    eventDate: String,
    occurrenceID: String,
    bibliographicCitation: String
}

type DarwinTaxon {
    scientificName: String!,
    taxonRank: String,
    kingdom: String,
    phylum: String,
    class: String,
    order: String,
    family: String,
    genus: String,
    specificEpithet:String
}
`
export default schema
