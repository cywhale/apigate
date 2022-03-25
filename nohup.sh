#!/bin/bash
echo "#---------------------NODE APIGATE Start at $(date '+%Y%m%d %H:%M:%S')"
vlog="nohup.out"
if ls "$vlog" 1> /dev/null 2>&1; then
  echo "#Warning: backup original nohup.out to ~/tmp/log"
  today=$(date +%Y%m%d)
  mv "$vlog" "/home/odbadmin/tmp/nohup_$today.log"

  if ls "$vlog".* 1> /dev/null 2>&1; then
#   echo "#Warning: backup additional original nohup.out.* to ver_bak/log"
    for file in "$vlog".*; do mv "$file" "/home/odbadmin/tmp/${file%.out%}"_$today.log; done
  fi

fi
export NODE_ENV="production" && nohup npx nodemon --exec npm run start </dev/null &

