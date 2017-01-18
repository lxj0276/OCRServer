#!/bin/bash

#--exclude "store.yaml"
rsync -auv  --exclude "node_modules"  --exclude "downloads" --exclude "web" --exclude "data" --progress ./ root@demo.huangjunchun.top:/mnt/poc/webserver