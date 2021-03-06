#!/bin/bash
if ls src/template.html 1> /dev/null 2>&1; then
  rm src/template.html
fi
export PORT=3000 && export NODE_ENV=development && yarn dev --https --cert config/fullchain.pem --key config/privkey.pem --config config/preact.config.js
