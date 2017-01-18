'use strict';

const jsYaml = require('js-yaml');
const fs = require('fs');
const log4js = require('log4js');

const logger = log4js.getLogger();

const SERVER_PORT = 3000;
const PROD_CONFIG = '/etc/inv_web_server.yaml';
const LOCAL_CONFIG = './data/inv_web_server.yaml';

let globalConfig = null;

const initConfig = function () {
  let configPath = null;

  if (fs.existsSync(PROD_CONFIG)) {
    configPath = PROD_CONFIG;
  } else if (fs.existsSync(LOCAL_CONFIG)) {
    configPath = LOCAL_CONFIG;
  }

  if (configPath === null) {
    return logger.error(`Can't find config file in ${PROD_CONFIG} or ${LOCAL_CONFIG}`);
  }

  logger.info(`Loading config file from ${configPath}`);

  globalConfig = jsYaml.safeLoad(fs.readFileSync(configPath, 'utf8')).config;

  logger.info(`Configuration: ${JSON.stringify(globalConfig)}`);
}

initConfig();


//
//
// //Wechat config
// const APPID = 'wx910c1661e0b7b82d';
// const APPSECRET = '295f4680a23447ba421ccbb6eeb1618d';
// const TOKEN = 'ec4890aaab49df5a59284cb7cf8fc1be';
//
// //other config
// const WEB_ROOT = './web';
// const DOWNLOAD_ROOT = './downloads';
// const OCR_SERVRE_URL = 'http://localhost:5000';
//
// const REDIS_DB = 1;


module.exports = {
  getAppId: function () {
    return globalConfig.wechat_mp.appid;
  },
  getAppSecret: function () {
    return globalConfig.wechat_mp.appsecret;
  },
  getToken: function () {
    return globalConfig.wechat_mp.token;
  },
  getWebRootPath: function () {
    return globalConfig.system.web_root;
  },
  getDownloadPath: function () {
    return globalConfig.system.download_root;
  },
  getOcrServerUrl: function () {
    return globalConfig.ocr_server.url;
  },
  getOcrServerImageRoot: function () {
    return globalConfig.ocr_server.image_root;
  },
  getRedisConfig: function () {
    return globalConfig.redis;
  },
  getFinConfig: function () {
    return globalConfig.fin_server;
  },
  getImageWebRoot: function () {
    return '/images';
  },
  // getFieldNameMap: function () {
  //   return {
  //     number: 'DocNumber',
  //     customer: 'Customer',
  //     price: 'Total',
  //     date: 'DocDate',
  //     lines: 'Items',
  //   };
  // },
  getWechatRoot: function(){
    return globalConfig.system.wechat_root;
  },
  getHttpServerPort: function(){
    return SERVER_PORT;
  }
};