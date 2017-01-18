'use strict';

const rp = require('request-promise');
const request = require('request');
const log4js = require('log4js');
const jsYaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const redis = require('redis');
const bluebird = require('bluebird');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);


const LOCAL_STORE_PATH = "./data/store.yaml";
const LOCAL_INVOICE_PATH = './data/invoices.json';
const DEFAULT_INV_ITEM_KEY_NAME = 'INV_DEFAULT_ITEM_NAME';


const redisConfig = config.getRedisConfig();
const client = redis.createClient({
  host: redisConfig.host,
  port: redisConfig.port,
  db: redisConfig.db,
});


const logger = log4js.getLogger();

//store[appid] = {accessToken: '', expiredAt: timestamp }
const getStore = function (appid) {
  if (!fs.existsSync(LOCAL_STORE_PATH)) {
    fs.closeSync(fs.openSync(LOCAL_STORE_PATH, 'w'));
  }

  let store = jsYaml.safeLoad(fs.readFileSync(LOCAL_STORE_PATH, 'utf8'));

  if (!store) {
    store = {};
  }

  return store[appid] || {};
}

const saveStore = function (appid, data) {
  if (!fs.existsSync(LOCAL_STORE_PATH)) {
    fs.closeSync(fs.openSync(LOCAL_STORE_PATH, 'w'));
  }

  let allStore = jsYaml.safeLoad(fs.readFileSync(LOCAL_STORE_PATH, 'utf8'));

  if (!allStore) {
    allStore = {};
  }

  allStore[appid] = data;

  fs.writeFileSync(LOCAL_STORE_PATH, jsYaml.safeDump(allStore), 'utf8');
};

const getAccessToken = function*(force = false) {
  let appStore = getStore(config.getAppId());

  if (appStore.expiredAt && appStore.accessToken) {
    let dtExpiredAt = new Date(appStore.expiredAt);

    if (dtExpiredAt >= Date.now()) {
      logger.debug('Get access_token from local storage because its not expired yet.');
      return appStore.accessToken;
    }
  }


  let data = yield rp({
    uri: 'https://api.weixin.qq.com/cgi-bin/token',
    qs: {
      grant_type: 'client_credential',
      appid: config.getAppId(),
      secret: config.getAppSecret(),
    },
    json: true
  });

  if (data && data.errcode) {
    logger.error(`Can't get access token, error: `, JSON.stringify(data));
  } else {
    logger.info(`AccessToken from Wechat, and save to local storage: `, JSON.stringify(data));

    appStore.accessToken = data.access_token;
    appStore.expiredAt = Date.now() + data.expires_in * 900;

    saveStore(config.getAppId(), appStore);

    return data.access_token;
  }
}


const getJsApiTicket = function*() {

  let appStore = getStore(config.getAppId());

  if (appStore.jsApiTicketExpiredAt && appStore.jsApiTicket) {
    let dtExpiredAt = new Date(appStore.jsApiTicketExpiredAt);

    if (dtExpiredAt >= Date.now()) {
      logger.debug('Get JsApiTicket from local storage because its not expired yet.');
      return appStore.jsApiTicket;
    }
  }

  const accessToken = yield getAccessToken();

  let data = yield rp({
    uri: 'https://api.weixin.qq.com/cgi-bin/ticket/getticket',
    qs: {
      type: 'jsapi',
      access_token: accessToken,
    },
    json: true
  });

  if (data && data.errcode) {
    logger.error(`Can't get JsApiTicket, error: `, JSON.stringify(data));
  } else {
    logger.info(`JsApiTicket from Wechat, and save to local storage: `, JSON.stringify(data));

    appStore.jsApiTicket = data.ticket;
    appStore.jsApiTicketExpiredAt = Date.now() + data.expires_in * 1000;

    saveStore(config.getAppId(), appStore);

    return data.ticket;
  }
}

/*
 Download wechat meda (e.g. image) by media, save to local disk and return the local file path.
 */
const downloadWechatMedia = function*(media_id, job_id) {
  const accessToken = yield getAccessToken();
  const mediaDownloadUrl = `http://file.api.weixin.qq.com/cgi-bin/media/get?access_token=${accessToken}&media_id=${media_id}`;
  const downloadRoot = config.getDownloadPath();
  const localFileName = `${downloadRoot}/${job_id}.jpg`;
  logger.debug(`Start download image to ${localFileName}, from url: ${mediaDownloadUrl}`);

  return new Promise(function (resolve, reject) {
    request(mediaDownloadUrl)
      .on('response', function (res) {
        let f = fs.createWriteStream(localFileName);
        res.pipe(f);

        res.on('end', function (d) {
          logger.debug('Download completed');
        }).on('error', function (err) {
          logger.error('Download error: ', err);
          return reject(err);
        });

        f.on('finish', function (d) {
          let stats = fs.statSync(localFileName);
          logger.debug(`Write file completed, file size: ${stats['size']}`);

          f.end();


          if (!stats || stats["size"] < 1000) {
            logger.error(`File ${localFileName} length is ${stats['size']}, it may some error during download`);

            //read all
            try {
              let errText = fs.readFileSync(localFileName, 'utf8');

              logger.error(errText);

              return reject(JSON.parse(errText).errmsg);
            } catch (ex) {
              logger.error(ex);
            }

            return reject(`Download error, file size is ${stats['size']}`);
          }

          return resolve(localFileName);
        });

      })
      .on('error', function (err) {
        logger.error('Download error: ', err);

        return reject(err);
      });
  });
}


const getStoreValue = function*(key) {
  let strJob = yield client.getAsync(key);

  let jobInfo = {};

  if (strJob) {
    jobInfo = JSON.parse(strJob);
  }

  return jobInfo
}

const setStoreValue = function*(key, data) {
  return client.setAsync(key, JSON.stringify(data));
}

/*
 file_path: ./tmp/ab/a.jpg  or   /user/desktop/tmp/ab/a.jpg
 return a web access url
 */
const convertOcrServerPathToWebUrl = function (file_path) {
  if(file_path === null){
    return null;
  }

  let imgRootPath = config.getOcrServerImageRoot();

  let abs_path = file_path

  if (!path.isAbsolute(file_path)) {
    abs_path = path.join(imgRootPath, file_path);
  }

  let web_url = abs_path.replace(imgRootPath, config.getImageWebRoot());

  return web_url;
}

const getLocalInvoice = function (docNum) {
  let localInvDB = {};

  try {
    localInvDB = JSON.parse(fs.readFileSync(LOCAL_INVOICE_PATH, 'utf8'));
  } catch (ex) {
    logger.error(`Load invoice files from ${LOCAL_INVOICE_PATH} failed, ${ex}`);
  }

  if (docNum in localInvDB) {
    return localInvDB[docNum];
  } else {
    return null;
  }
}

const setLocalInvoice = function (docNum, data) {
  let localInvDB = {};

  try {
    localInvDB = JSON.parse(fs.readFileSync(LOCAL_INVOICE_PATH, 'utf8'));
  } catch (ex) {
    logger.error(`Load invoice files from ${LOCAL_INVOICE_PATH} failed, ${ex}`);
  }

  localInvDB[docNum] = data;

  fs.writeFileSync(LOCAL_INVOICE_PATH, JSON.stringify(localInvDB), 'utf8');
}


const removeLocalInvoice = function(docNum){
  let localInvDB = {};

  try {
    localInvDB = JSON.parse(fs.readFileSync(LOCAL_INVOICE_PATH, 'utf8'));
  } catch (ex) {
    logger.error(`Load invoice files from ${LOCAL_INVOICE_PATH} failed, ${ex}`);
  }

  if(docNum in localInvDB){
    delete localInvDB[docNum];

    fs.writeFileSync(LOCAL_INVOICE_PATH, JSON.stringify(localInvDB), 'utf8');

    return true;
  }else{
    return false;
  }
}

const getAllLocalInvoices = function () {
  let localInvDB = {};

  try {
    localInvDB = JSON.parse(fs.readFileSync(LOCAL_INVOICE_PATH, 'utf8'));
  } catch (ex) {
    logger.error(`Load invoice files from ${LOCAL_INVOICE_PATH} failed, ${ex}`);
  }

  let invoices = [];

  for (let key of Object.keys(localInvDB)) {
    if (key !== DEFAULT_INV_ITEM_KEY_NAME) {
      invoices.push(localInvDB[key]);
    }
  }

  invoices.sort((a, b) => {
    if (a.DocNumber > b.DocNumber) {
      return 1;
    } else if (a.DocNumber < b.DocNumber) {
      return -1;
    } else {
      return 0;
    }
  });

  return invoices;
}


const getDefaultInvItemName = function () {
  return getLocalInvoice(DEFAULT_INV_ITEM_KEY_NAME);
}

const setDefaultInvItemName = function (name) {
  return setLocalInvoice(DEFAULT_INV_ITEM_KEY_NAME, name);
}

module.exports = {
  convertOcrServerPathToWebUrl,
  downloadWechatMedia,
  getAccessToken,
  getJsApiTicket,
  getStoreValue,
  setStoreValue,
  getLocalInvoice,
  setLocalInvoice,
  removeLocalInvoice,
  getDefaultInvItemName,
  setDefaultInvItemName,
  getAllLocalInvoices,
};