import Spkey from '../models/spkey_mongoose';
// https://stackoverflow.com/questions/65139097/make-node-tree-with-recursive-table-with-express-and-mongo/65166480#65166480
// playgound: https://mongoplayground.net/p/JPZzbb2Cb7x 20220415 update
// https://mongoplayground.net/p/OwK6WICgyG_ 20220416 update
// https://mongoplayground.net/p/m7IRnntI6jg 20220420 modified for keeping taxon figures
// https://mongoplayground.net/p/I-fwuusIO7I 20220421 for Labidocera detruncata temp (not code err, but data err from docx, a branch prior(prev key) to 27b and typo to 27a
// https://mongoplayground.net/p/5h-uhSuyidr 20220422 (temp) for Acartia bifilosa
// 20220425 change strategy from top2bottom(t2b) to bottom2top(b2t) (so make the initial point is certain)
// 20220425 playground https://mongoplayground.net/p/a13CZxjTGN3
export default async function keytree(taxon) {

let genus = taxon.split(/\s/)[0];
let result = await Spkey.aggregate([
  {
    $match: {
      $and: [
        {
          //$or: [
          //  {
              "type": {
                "$in": [
                  1,
                  2
                ]
              }
          /*},//$"nin": [-1, 2] if t2b in older version
            {
              "type": 2,
              "taxon": taxon
            } // no need when b2t because initial point is certain with specific taxon
          ]*/
        }, // 20220420 modified with figure(2)
        //Not figures (2), and not genus (-1)
        /*{
          "pkey": {
            "$in": [
              null,
              ""
            ]
          }
        },
        //genus for testing: "Acartia"
        {
          "genus": genus
        }*/ //t2b needs initial point is pkey==null, and restrict possibility to specific genus
        {
          "taxon": taxon
        }
      ]
    }
  },
  {
    $project: {
      "unikey": 1,
      "pkey": 1,
      "taxon": 1,
      "type": 1,
      "ctxt": 1,
      "sex": 1
    }
  },
  {
    $graphLookup: {
      from: "spkey",
      startWith: "$pkey", //"$unikey", //old t2b
      connectFromField: "pkey", //"unikey",
      connectToField: "unikey", //"pkey",
      depthField: "level",
      as: "children"
    }
  },
  {
    $unwind: {
      path: "$children",
      preserveNullAndEmptyArrays: true
    }
  }, //to keep figure(type=2) must preserveNullAndEmptyArrays: true (otherwise can be false)
  {
    $sort: {
      "children.level": -1
    }
  },
  {
    $group: {
      _id: "$unikey",
      pkey: {
        $first: "$pkey"
      },
      taxon: {
        $first: "$taxon"
      },
      type: {
        $first: "$type"
      },
      ctxt: {
        $first: "$ctxt"
      },
      sex: {
        $first: "$sex"
      },
      children: {
        $push: "$children"
      }/*, //old t2b, no need in b2t
      taxonarr: {
        $push: {
          $convert: {
            input: {
              $or: [
                {
                  $eq: [
                    "$children.taxon",
                    taxon
                  ]
                },
                {
                  $eq: [
                    "$taxon",
                    taxon
                  ]
                } //20220420 modified: for figures of taxon
              ]
            }, //previous $ne: ["$children.taxon", ""]
            to: "bool"
          }
          //if taxon=="" get false (to filter all "" of taxon in children/tree-branch
        }
      }*/
    }
  },
  {
    $project: {
      "_id": 1,
      "unikey": "$_id",
      "pkey": 1,
      "taxon": 1,
      "ctxt": 1,
      "sex": 1,
/*      isAnyTaxon: {
        $anyElementTrue: [
          "$taxonarr"
        ]
      },*/ // old t2b
      "children": {
        $filter: {
          input: "$children",
          as: "child",
          cond: {
            $or: [
              {
                $eq: [
                  "$$child.taxon",
                  taxon
                ]
              },
              //taxon for testing: "Acartia hongi"
              {
                $and: [
                  {
                    $eq: [
                      "$$child.type",
                      0
                    ]
                  },
                  {
                    $eq: [
                      "$$child.taxon",
                      ""
                    ]
                  }
                ]
              }
            ]
          }
        }
      }
    }
  },
/*{
    $match: {
      "isAnyTaxon": true
    }
  },*/ //old t2b
 //to filter all "" of taxon in children/tree-branch
  {
    $addFields: {
      children: {
        $reduce: {
          input: "$children",
          initialValue: {
            level: -1,
            presentChild: [],
            prevChild: []
          },
          in: {
            $let: {
              vars: {
                prev: {
                  $cond: [
                    {
                      $eq: [
                        "$$value.level",
                        "$$this.level"
                      ]
                    },
                    "$$value.prevChild",
                    "$$value.presentChild"
                  ]
                },
                current: {
                  $cond: [
                    {
                      $eq: [
                        "$$value.level",
                        "$$this.level"
                      ]
                    },
                    "$$value.presentChild",
                    []
                  ]
                }
              },
              in: {
                level: "$$this.level",
                prevChild: "$$prev",
                presentChild: {
                  $concatArrays: [
                    "$$current",
                    [
                      {
                        $mergeObjects: [
                          "$$this",
                          {
                            children: {
                              $filter: {
                                input: "$$prev",
                                as: "e",
                                cond: {
                                  $eq: [
                                    "$$e.unikey", //"$$e.pkey", //old t2b
                                    "$$this.pkey" //"$$this.unikey"
                                  ]
                                }
                              }
                            }
                          }
                        ]
                      }
                    ]
                  ]
                }
              }
            }
          }
        }
      }
    }
  },
  {
    $addFields: {
      children: "$children.presentChild"
    }
  } /*,
  {
    $project: {
      "_id": 1,
      "unikey": "$_id",
      "pkey": 1,
      "taxon": 1,
      "ctxt": 1,
      "sex": 1,
      "children": {
        $filter: {
          input: "$children",
          as: "child",
          cond: {
            $or: [
              {
                $eq: [
                  "$$child.taxon",
                  taxon
                ]
              },
              {
                $and: [
                  {
                    $ne: [
                      "$$child.children",
                      []
                    ]
                  },
                  // empty leaf will be removed
                  {
                    $eq: [
                      "$$child.type",
                      0
                    ]
                  },
                  {
                    $eq: [
                      "$$child.taxon",
                      ""
                    ]
                  }
                ]
              }
            ]
          }
        }
      }
    }
  } */ //old t2b
]).exec()

return result
}
//test data
/*
[
  {
    "unikey": "00a_genus_180a_00x_Acartia",
    "pkey": "178",
    "genus": null,
    "taxon": "Acartia",
    "type": 1
  },
  {
    "unikey": "00a_genus_181a_figs_213_214",
    "pkey": "",
    "genus": null,
    "taxon": "Acartia bilobata,Acartia bilobata",
    "type": 2
  },
  {
    "unikey": "Acartia_00a_genus",
    "pkey": "",
    "genus": "Acartia",
    "taxon": "",
    "type": -1
  },
  {
    "unikey": "Acartia_01a",
    "pkey": "",
    "genus": "Acartia",
    "taxon": "",
    "type": 0
  },
  {
    "unikey": "Acartia_01b",
    "pkey": "",
    "genus": "Acartia",
    "taxon": "",
    "type": 0
  },
  {
    "unikey": "Acartia_02a",
    "pkey": "Acartia_01b",
    "genus": "Acartia",
    "taxon": "",
    "type": 0
  },
  {
    "unikey": "Acartia_02b",
    "pkey": "Acartia_01b",
    "genus": "Acartia",
    "taxon": "",
    "type": 0
  },
  {
    "unikey": "Acartia_03a",
    "pkey": "Acartia_02a",
    "genus": "Acartia",
    "taxon": "",
    "type": 0
  },
  {
    "unikey": "Acartia_03b",
    "pkey": "Acartia_02a",
    "genus": "Acartia",
    "taxon": "",
    "type": 0
  },
  {
    "unikey": "Acartia_04a",
    "pkey": "Acartia_02b",
    "genus": "Acartia",
    "taxon": "",
    "type": 0
  },
  {
    "unikey": "Acartia_04b",
    "pkey": "Acartia_02b",
    "genus": "Acartia",
    "taxon": "",
    "type": 0
  },
  {
    "unikey": "Acartia_05a",
    "pkey": "Acartia_01a",
    "genus": "Acartia",
    "taxon": "",
    "type": 0
  },
  {
    "unikey": "Acartia_05b",
    "pkey": "Acartia_01a",
    "genus": "Acartia",
    "taxon": "",
    "type": 0
  },
  {
    "unikey": "Acartia_06a",
    "pkey": "Acartia_05a",
    "genus": "Acartia",
    "taxon": "Acartia longiremis",
    "type": 1
  },
  {
    "unikey": "Acartia_06a_11b_longiremis_fig",
    "pkey": "",
    "genus": "Acartia",
    "taxon": "Acartia longiremis",
    "type": 2
  },
  {
    "unikey": "Acartia_06b",
    "pkey": "Acartia_05a",
    "genus": "Acartia",
    "taxon": "",
    "type": 0
  },
  {
    "unikey": "Acartia_07a",
    "pkey": "Acartia_06b",
    "genus": "Acartia",
    "taxon": "",
    "type": 0
  },
  {
    "unikey": "Acartia_07b",
    "pkey": "Acartia_06b",
    "genus": "Acartia",
    "taxon": "",
    "type": 0
  },
  {
    "unikey": "Acartia_08a",
    "pkey": "Acartia_07a",
    "genus": "Acartia",
    "taxon": "Acartia clausi",
    "type": 1
  },
  {
    "unikey": "Acartia_08a_12a_clausi_fig",
    "pkey": "",
    "genus": "Acartia",
    "taxon": "Acartia clausi",
    "type": 2
  },
  {
    "unikey": "Acartia_08b",
    "pkey": "Acartia_07a",
    "genus": "Acartia",
    "taxon": "Acartia omorii",
    "type": 1
  },
  {
    "unikey": "Acartia_08b_13a_omorii_fig",
    "pkey": "",
    "genus": "Acartia",
    "taxon": "Acartia omorii",
    "type": 2
  },
  {
    "unikey": "Acartia_09a",
    "pkey": "Acartia_07b",
    "genus": "Acartia",
    "taxon": "Acartia hudsonica",
    "type": 1
  },
  {
    "unikey": "Acartia_09a_11a_hudsonica_fig",
    "pkey": "",
    "genus": "Acartia",
    "taxon": "Acartia hudsonica",
    "type": 2
  },
  {
    "unikey": "Acartia_09b",
    "pkey": "Acartia_07b",
    "genus": "Acartia",
    "taxon": "Acartia hongi",
    "type": 1
  },
  {
    "unikey": "Acartia_09b_13b_hongi_fig",
    "pkey": "",
    "genus": "Acartia",
    "taxon": "Acartia hongi",
    "type": 2
  },
  {
    "unikey": "Acartia_10a",
    "pkey": "Acartia_05b",
    "genus": "Acartia",
    "taxon": "",
    "type": 0
  },
  {
    "unikey": "Acartia_10b",
    "pkey": "Acartia_05b",
    "genus": "Acartia",
    "taxon": "",
    "type": 0
  },
  {
    "unikey": "Acartia_11a",
    "pkey": "Acartia_10a",
    "genus": "Acartia",
    "taxon": "Acartia hudsonica",
    "type": 1
  },
  {
    "unikey": "Acartia_11b",
    "pkey": "Acartia_10a",
    "genus": "Acartia",
    "taxon": "Acartia longiremis",
    "type": 1
  },
  {
    "unikey": "Acartia_12a",
    "pkey": "Acartia_10b",
    "genus": "Acartia",
    "taxon": "Acartia clausi",
    "type": 1
  },
  {
    "unikey": "Acartia_12b",
    "pkey": "Acartia_10b",
    "genus": "Acartia",
    "taxon": "",
    "type": 0
  },
  {
    "unikey": "Acartia_13a",
    "pkey": "Acartia_12b",
    "genus": "Acartia",
    "taxon": "Acartia omorii",
    "type": 1
  },
  {
    "unikey": "Acartia_13b",
    "pkey": "Acartia_12b",
    "genus": "Acartia",
    "taxon": "Acartia hongi",
    "type": 1
  }
]
*/

/* test result
[
  {
    "_id": "Acartia_01a",
    "children": [
      {
        "_id": ObjectId("5a934e00010203040500000c"),
        "children": [
          {
            "_id": ObjectId("5a934e00010203040500001b"),
            "children": [
              {
                "_id": ObjectId("5a934e00010203040500001f"),
                "children": [
                  {
                    "_id": ObjectId("5a934e000102030405000021"),
                    "children": [],
                    "genus": "Acartia",
                    "level": NumberLong(3),
                    "pkey": "Acartia_12b",
                    "taxon": "Acartia hongi",
                    "type": 1,
                    "unikey": "Acartia_13b"
                  }
                ],
                "genus": "Acartia",
                "level": NumberLong(2),
                "pkey": "Acartia_10b",
                "taxon": "",
                "type": 0,
                "unikey": "Acartia_12b"
              }
            ],
            "genus": "Acartia",
            "level": NumberLong(1),
            "pkey": "Acartia_05b",
            "taxon": "",
            "type": 0,
            "unikey": "Acartia_10b"
          },
          {
            "_id": ObjectId("5a934e00010203040500001a"),
            "children": [],
            "genus": "Acartia",
            "level": NumberLong(1),
            "pkey": "Acartia_05b",
            "taxon": "",
            "type": 0,
            "unikey": "Acartia_10a"
          }
        ],
        "genus": "Acartia",
        "level": NumberLong(0),
        "pkey": "Acartia_01a",
        "taxon": "",
        "type": 0,
        "unikey": "Acartia_05b"
      },
      {
        "_id": ObjectId("5a934e00010203040500000b"),
        "children": [
          {
            "_id": ObjectId("5a934e00010203040500000f"),
            "children": [
              {
                "_id": ObjectId("5a934e000102030405000011"),
                "children": [
                  {
                    "_id": ObjectId("5a934e000102030405000018"),
                    "children": [],
                    "genus": "Acartia",
                    "level": NumberLong(3),
                    "pkey": "Acartia_07b",
                    "taxon": "Acartia hongi",
                    "type": 1,
                    "unikey": "Acartia_09b"
                  }
                ],
                "genus": "Acartia",
                "level": NumberLong(2),
                "pkey": "Acartia_06b",
                "taxon": "",
                "type": 0,
                "unikey": "Acartia_07b"
              },
              {
                "_id": ObjectId("5a934e000102030405000010"),
                "children": [],
                "genus": "Acartia",
                "level": NumberLong(2),
                "pkey": "Acartia_06b",
                "taxon": "",
                "type": 0,
                "unikey": "Acartia_07a"
              }
            ],
            "genus": "Acartia",
            "level": NumberLong(1),
            "pkey": "Acartia_05a",
            "taxon": "",
            "type": 0,
            "unikey": "Acartia_06b"
          }
        ],
        "genus": "Acartia",
        "level": NumberLong(0),
        "pkey": "Acartia_01a",
        "taxon": "",
        "type": 0,
        "unikey": "Acartia_05a"
      }
    ],
    "isAnyTaxon": true,
    "pkey": ""
  }
]
*/
