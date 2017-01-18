#!/bin/bash

rsync -auv  --exclude "node_modules"  --exclude "src" --exclude "qrcode" --progress ./ root@dev.huangjunchun.top:/mnt/poc/webroot
