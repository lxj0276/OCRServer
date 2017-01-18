repo for invoice ocr scan


0. Guide

This project is for PoC of invoice-scanner. It contains three sub-project:
* ocr_server: a python based micro-service, invoice image recognizing and ocr, provided by OpenCV 3.2
* web_server: a nodejs based web server, providing WeChat interface and communication with ocr_server.
* web_ui: a React based HTML5 UI, with front-end WeChat scanner and admin-portal for management.

It also needs SAP Anywhere FIN as ERP backend to process invoice create. For these information, please contact Zhu, Stephen <stephen.zhu@sap.com>.


1. Environment
Here is the configuration of dev/prod environment requirements.

ocr_server: python 3.4/3.5/3.6, OpenCV 3.2, Pillow 4.0, Flask 0.12, Tornado 4.4
web_server: node 6.9, npm
web_ui: React with ES2015, webpack

Ubuntu Server 16.04 for production environment, OpenCV 3.2 should be built from source with extra_modules.
Here is the cmake script for OpenCV 3.2:

cmake -D CMAKE_BUILD_TYPE=RELEASE \
    -D CMAKE_INSTALL_PREFIX=/usr/local \
    -D INSTALL_PYTHON_EXAMPLES=ON \
    -D INSTALL_C_EXAMPLES=OFF \
    -D OPENCV_EXTRA_MODULES_PATH=/mnt/libs/opencv_contrib/modules \
    -D BUILD_EXAMPLES=OFF .. 


Some requirements for OpenCV 3.2 on Ubuntu 16.04: http://www.cnblogs.com/asmer-stone/p/5089764.html

For dev environment, its works well on Mac with script:

brew install --HEAD opencv3 --with-contrib --with-python3


2. Build

ocr_server: python based, no build required.
web_server: nodejs based, no build required. For installing libs, using “npm install”
web_ui: webpack project, build by ./build.sh in this project folder. For installing libs, using “npm install”


3. Deploy

Currently, the project deployed on Aliyun, because WeChat requires public IP/domain addresses. Now we have two environments for this PoC: dev (for test & dev) and demo (for production). The domains are:
Dev: dev.huangjunchun.top
Demo: demo.huangjunchun.top

Notice: This domain is no available in SAP-Corporate, please use SAP-internet or proxy to access them.

To upload code to server, just use script sync_to_demo.sh and sync_to_dev.sh in each sub-project.


4. Wiki:

Invoice Scanner Configuration and Maintenance: https://jam4.sapjam.com/wiki/show/jcdBDaxtlJdrM5axGXAkBu
How to use Invoice Scanner: https://jam4.sapjam.com/wiki/show/iRzdDDTpZZ8pDQfypSqg81


5. Contacts:

Huang, Junchun <junchun.huang@sap.com> (main)
Zhu, Stephen <stephen.zhu@sap.com>
Lv, Kobe <kobe.lv@sap.com>

