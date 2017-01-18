#!/bin/bash

#--exclude "store.yaml"
rsync -auv --progress --exclude "tmp" ./ root@demo.huangjunchun.top:/mnt/poc/ocrserver
