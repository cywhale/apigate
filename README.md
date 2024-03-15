# ODB Open API

[![DOI](https://zenodo.org/badge/doi/10.5281/zenodo.8250170.svg)](https://doi.org/10.5281/zenodo.8250170)

#### Swagger API doc

[ODB CTD/SADCP API manual/online try-out](https://api.odb.ntu.edu.tw/hub/swagger?node=odb_ctd_sadcp_v1)

#### Usage

1. ODB SADCP API: Get [SADCP/current mean data](https://www.odb.ntu.edu.tw/adcp/) collected by research vessels in the waters around Taiwan.

* e.g: https://ecodata.odb.ntu.edu.tw/api/sadcp?lon0=120&lon1=135&lat0=20&lat1=35&dep0=100

2. ODB CTD API: Get [CTD mean data](https://www.odb.ntu.edu.tw/ctd/) collected by research vessels in the waters around Taiwan.

* e.g: https://ecodata.odb.ntu.edu.tw/api/ctd?lon0=120&lon1=135&lat0=20&lat1=35&dep0=100

#### Demo 

[![Demo_by_CTD_API](https://github.com/cywhale/ODB/blob/master/img/ctd_api_demo_byGMT01.png)](https://github.com/cywhale/ODB/blob/master/img/ctd_api_demo_byGMT01.png)<br/>
*Use the CTD mean data queried by the ODB CTD API to plot the sea temperature and salinity distribution in the waters around Taiwan and the sea temperature, salinity and density profiles along 22°N.*

#### Attribution              

Reference: 
1. https://www.odb.ntu.edu.tw/adcp/
2. https://www.odb.ntu.edu.tw/ctd/

#### Citation

* This API is compiled by [Ocean Data Bank](https://www.odb.ntu.edu.tw) (ODB), and can be cited as:

    * Ocean Data Bank, National Science and Technology Council, Taiwan. https://doi.org/10.5281/zenodo.7512112. Accessed DAY/MONTH/YEAR from ecodata.odb.ntu.edu.tw/api/sadcp. v1.0.

    * Ocean Data Bank, National Science and Technology Council, Taiwan. https://doi.org/10.5281/zenodo.7512112. Accessed DAY/MONTH/YEAR from ecodata.odb.ntu.edu.tw/api/ctd. v1.0.

