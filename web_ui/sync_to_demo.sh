#!/bin/bash

rsync -auv  --exclude "node_modules"  --exclude "src" --exclude "qrcode" --progress ./ root@demo.huangjunchun.top:/mnt/poc/webroot