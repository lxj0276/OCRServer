#!/bin/bash

#--exclude "store.yaml"
rsync -auv --progress --exclude "tmp" ./ root@dev.huangjunchun.top:/mnt/poc/ocrserver
