const schema = `
type Query {
     taxontree: [TreeNode]!
     infq(taxon: String, keystr: Boolean, mode: String, first: Int, last: Int, after: String, before: String, key: String): SpkeyConn
     keys(sp: String!): [Spkeyq]!
     keytree(sp: String!): [KeyNode]!
}

type KeyNode {
  _id: ID!
  taxonarr: [String]
  isAnyTaxon: Boolean
  unikey: String
  pkey: String
  taxon: String
  level: Int
  type: Int
  ctxt: String
  sex: String
  children: [KeyNode]
}

type Spkeyq {
     unikey: String
     pkey: String
     taxon: String
     fullname: String
     genus: String
     family: String
     keystr: String
     sex: String
     ctxt: String
     docn: Int
     type: Int
     kcnt: Int
}

type SpkeyConn {
  totalCount: Int
  pageInfo: PageInfo
  edges: SpkeyEdge
}

type PageInfo {
  num: Int
  hasNextPage: Boolean
  hasPreviousPage: Boolean
}

type SpkeyEdge {
  node: [Spkeyq]
  cursor: String
  endCursor: String
}

type TreeNode {
  label: String!
  value: String!
  children: [Treelevel]!
}

type Treelevel {
  label: String!
  value: String!
  children: [Treeleaf]
}

type Treeleaf {
  label: String!
  value: String!
}
`
export default schema
