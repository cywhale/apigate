# API Patterns

## SADCP

- Endpoint: `https://ecodata.odb.ntu.edu.tw/api/sadcp`
- Common fields: `u,v,speed,direction,count`
- Good uses:
  - `dep_mode=mean`
  - annual `mode=0`
  - monsoon `mode=17`, `mode=18`
  - month-like modes when supported by the API
- Practical plotting defaults:
  - keep vector arrows visually short rather than long
  - treat `count` as a simple quality screen; a practical default is `count >= 30`
  - allow the count threshold to remain user-adjustable
  - in shallow shelves or narrow straits, a narrower subsurface layer such as `30-100 m` can be cleaner than `0-200 m`

Example:

```text
lon0=119.5&lon1=123.5&lat0=20.5&lat1=26.5&dep0=20&dep1=300&dep_mode=mean&mode=0&append=u,v,speed,direction,count
```

## CTD

- Endpoint: `https://ecodata.odb.ntu.edu.tw/api/ctd`
- Common fields: `temperature,salinity,density,count`
- Good uses:
  - mean hydrography maps
  - fixed-lat or fixed-lon sections
  - subsurface structure analogies

Example:

```text
lon0=117&lon1=122&lat0=18&lat1=22&dep0=50&dep1=150&dep_mode=mean&mode=5&append=temperature,salinity,density,count
```

## GEBCO

- Endpoint: `https://api.odb.ntu.edu.tw/gebco`
- Use polygon mode with tiled fetches.
- For large domains, do not insist on `sample=1`.

Example:

```text
mode=zonly&sample=5&jsonsrc={"type":"Polygon","coordinates":[[[121,22.5],[121,23.5],[122,23.5],[122,22.5],[121,22.5]]]}
```

## MHW

- Endpoint: `https://eco.odb.ntu.edu.tw/api/mhw`
- Common fields: `sst,sst_anomaly,level`
- Respect payload rules:
  - small area can span longer time
  - large area must shorten time span

Example:

```text
lon0=134&lon1=141.5&lat0=30&lat1=35.5&start=2017-07-01&end=2017-07-01&append=sst,sst_anomaly,level
```
