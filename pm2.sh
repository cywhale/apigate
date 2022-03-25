#!/bin/bash
echo "#---------------------NODE APIGATE Start at $(date '+%Y%m%d %H:%M:%S')"
export NODE_ENV="production" && PORT=3000 pm2 -n apigate start -i 2 server/server.js

