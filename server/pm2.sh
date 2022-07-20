#!/bin/bash
echo "#---------------------APIGATE Start at $(date '+%Y%m%d %H:%M:%S')"
export NODE_OPTIONS=--max_old_space_size=8192 && export NODE_ENV="production" && PORT=3000 pm2 -n apigate start -i 2 npm -- run start src/index.js

