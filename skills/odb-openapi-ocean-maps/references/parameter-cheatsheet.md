# Parameter Cheatsheet

Use this file for common cases. If you need uncommon parameters, open the official OAS URLs instead of guessing.

## SADCP

- Common spatial parameters:
  - `lon0`, `lon1`, `lat0`, `lat1`
- Common depth parameters:
  - `dep0`, `dep1`, `dep_mode=mean`
- Common temporal selector:
  - `mode=0` for annual mean
  - `mode=17` for NE monsoon
  - `mode=18` for SW monsoon
  - monthly modes may exist; do not guess the full list from memory
  - if you need a specific month mode, verify it against the official OAS before using it
- Common `append` fields:
  - `u`, `v`, `speed`, `direction`, `count`

Official OAS:
- [SADCP OAS](https://api.odb.ntu.edu.tw/search/schema?node=odb_ctd_sadcp_v1%3E/api/sadcp)

## CTD

- Common spatial parameters:
  - `lon0`, `lon1`, `lat0`, `lat1`
- Common depth parameters:
  - `dep0`, `dep1`, `dep_mode=mean`
- Common temporal selector:
  - `mode=0` for annual mean
  - monthly modes may exist; verify them in the official OAS before use
- Common `append` fields:
  - `temperature`, `salinity`, `density`, `count`

Official OAS:
- [CTD OAS](https://api.odb.ntu.edu.tw/search/schema?node=odb_ctd_sadcp_v1%3E/api/ctd)

## MHW

- Common spatial parameters:
  - `lon0`, `lon1`, `lat0`, `lat1`
- Common time parameters:
  - `start`, `end`
- Common `append` fields:
  - `sst`, `sst_anomaly`, `level`

Official OAS:
- [MHW OAS](https://api.odb.ntu.edu.tw/search/schema?node=odb_mhw_v1)

## GEBCO

- Common parameters:
  - `mode=zonly`
  - `sample`
  - `jsonsrc` with polygon geometry

Official OAS:
- [GEBCO OAS](https://api.odb.ntu.edu.tw/search/schema?node=odb_gebco_v1)

## Rule

- Do not paste whole OAS JSON into the skill.
- Keep this cheatsheet short.
- If a task needs a rare field or edge-case parameter, read the official OAS page on demand.
