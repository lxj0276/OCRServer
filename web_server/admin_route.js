'use strict';

const koa = require('koa');
const koaRouter = require('koa-router');
const sha1 = require('sha1');
const log4js = require('log4js');
const rp = require('request-promise');
const Path = require('path');
const fin = require('./fin');
const fs = require('fs');

const util = require('./util');
const config = require('./config');
const ocrParser = require('./ocr_convert');


const logger = log4js.getLogger();
const router = koaRouter();

router.get('/admin/config/fin', function *(next) {
  this.body = config.getFinConfig();

  yield next;
});


//list top 50 jobs information
router.get('/admin/config/wechat', function*(next) {

  let finConfig = config.getFinConfig();

  this.body = {
    code: 0,
    message: 'OK',
    data: {
      url: config.getWechatRoot(),
      tenant_id: finConfig.tenant_id,
      user_id: finConfig.user_id,
      api_url: finConfig.url,
    },
  };
  yield next;

});



router.get('/admin/invoices', function*(next) {
  this.body = {
    code: 0,
    message: 'OK',
    data: util.getAllLocalInvoices()
  };

  yield next;
});

//create or update a local invoice
router.post('/admin/invoices', function*(next) {
  let data = this.request.body;

  if (!data.DocNumber) {
    throw new Error('Missing parameter: docNumber')
  }

  util.setLocalInvoice(data.DocNumber, data);

  this.body = {
    code: 0,
    message: 'OK',
    data: true
  };

  yield next;
});

router.delete('/admin/invoices/:docNumber', function*(next) {
  util.removeLocalInvoice(this.params.docNumber);

  this.body = {
    code: 0,
    message: 'OK',
    data: true
  };

  yield next;
});

router.get('/admin/default_product_name', function*(next) {
  this.body = {
    code: 0,
    message: 'OK',
    data: util.getDefaultInvItemName()
  };

  yield next;
});

router.post('/admin/default_product_name', function*(next) {
  let data = this.request.body;

  if (data.name) {
    util.setDefaultInvItemName(data.name);
  } else {
    throw new Error('name does not exist in data');
  }

  this.body = {
    code: 0,
    message: 'OK',
    data: true
  };

  yield next;
});


const listImageFiles = function (path) {
  const IMAGE_FILE_EXT = ['.jpg', '.png'];
  const LIMIT = 30;
  const localImageRoot = config.getOcrServerImageRoot();
  const webImageRoot = config.getImageWebRoot();

  let filename = Path.basename(path);

  if (fs.lstatSync(path).isDirectory()) {

    let listDir = [];
    for (let file of fs.readdirSync(path)) {
      listDir.push(Path.join(path, file));
    }

    listDir.sort((a,b)=>{
      if(a > b){
        return -1;
      }else if(a < b){
        return 1;
      }else{
        return 0;
      }
    });
    listDir = listDir.slice(0, LIMIT);

    let dirRes = [];

    for (let dirPath of listDir) {
      let x = listImageFiles(dirPath);
      if (x) {
        if ('children' in x && x['children'].length == 0) {
          continue;
        }
        dirRes.push(x)
      }
    }

    return {
      value: webImageRoot + path.replace(localImageRoot,''),
      label: filename,
      children: dirRes,
    }
  } else {
    if (IMAGE_FILE_EXT.includes(Path.extname(path).toLowerCase())) {
      return {
        value: webImageRoot + path.replace(localImageRoot,''),
        label: filename
      }
    } else {
      return null;
    }
  }


}

//list top 50 jobs information
router.get('/admin/jobs', function*(next) {
  const root = config.getOcrServerImageRoot();

  let res = listImageFiles(root);

  this.body = {
    code: 0,
    message: 'OK',
    data: res,
  };
  yield next;

});



module.exports = router;