#!/bin/bash
echo "#---------------------Copkey Start at $(date '+%Y%m%d %H:%M:%S')"
export NODE_ENV="production" && PORT=3000 pm2 -n copkey start -i 2 npm -- run start src/index.js

