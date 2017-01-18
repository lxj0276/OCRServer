'use strict';

const koa = require('koa');
const koaRouter = require('koa-router');
const sha1 = require('sha1');
const log4js = require('log4js');
const rp = require('request-promise');
const path = require('path');
const fin = require('./fin');

const util = require('./util');
const config = require('./config');
const ocrParser = require('./ocr_convert');


const logger = log4js.getLogger();
const router = koaRouter();


function getJobId() {
  let d = new Date();
  d = d.getFullYear() + "" + ('0' + (d.getMonth() + 1)).slice(-2) + "" + ('0' + d.getDate()).slice(-2)
    + "T" + ('0' + d.getHours()).slice(-2) + "" + ('0' + d.getMinutes()).slice(-2) + "" + ('0' + d.getSeconds()).slice(-2)
    + "X" + parseInt(Math.random() * 10000);
  return d;
}


//
// redis store format:
//
// job_id: {
//    type: 'name of type',
//    file_path: '', the origin_image_file path, absolute
//    compress_file: '', the normalized-compressed file path, absolute
//    finAttachmentId: '1132198123',  the attachment id for this job, related to FIN service
//    user_id: '111',
//    tenant_id: '111',
//    api_url: 'https://...',
// }


//validate token
router.get('/mp/callback', function *(next) {

  let tmpStr = [this.request.query.timestamp, this.request.query.nonce, config.getToken()].sort().join('');

  if (sha1(tmpStr) === this.request.query.signature) {
    logger.info('Validation success');
    this.body = this.request.query.echostr;
  } else {
    this.body = null;
  }

  yield next;
});

router.post('/mp/callback', function*(next) {
  this.body = '';
  yield next;
});

router.get('/mp/access_token', function *(next) {
  let d = yield util.getAccessToken();
  this.body = d;

  yield next;
});
router.get('/mp/jsapi_ticket', function *(next) {
  let d = yield util.getJsApiTicket();
  this.body = d;

  yield next;
});

/*
 post body format: {
 url: "http://..../a.html"
 }
 */
router.post('/mp/jsapi_signature', function*(next) {
  let jsApiTicket = yield util.getJsApiTicket();
  let data = this.request.body;

  let timestamp = Date.now();
  let nonceStr = String(Math.random(1));

  const toSignatureStr = `jsapi_ticket=${jsApiTicket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${data.url}`;
  const signature = sha1(toSignatureStr);

  this.body = {
    appId: config.getAppId(),
    timestamp: timestamp,
    nonceStr: nonceStr,
    signature: signature
  };

  yield next;
});


/*
 download image from wechat by media_id

 post body: {
 media_id: 'TnG35XHcjt8NDFeNIVEXn6dsFgouK_g9lAOvw7PtoUxtLSm92bRTx7mZAQaEsK9l',
 tenant_id: null,
 user_id: null,
 api_url: null,
 }

 return {
 code: 0,
 message: 'ok',
 data: {
 job_id: '123992323232'
 }
 }
 */
router.post('/mp/process/download', function*(next) {
  let data = this.request.body;
  let job_id = getJobId();

  let localFilePath = null;

  if (data.media_id === '4OzkAy-vFFn7fqycZFKwtJgUjDICJz9WkHuBDk_COPxCKlVBTexkJ3NFCeT1zSyS') {
    localFilePath = '/Users/i064027/Desktop/local_debug/big2.jpg'

    //20161227T101344X647.jpg
    //20161227T134152X889.jpg
    //20161230T233801X3135.jpg
  }

  if (!localFilePath) {
    localFilePath = yield util.downloadWechatMedia(data.media_id, job_id);
  }


  logger.info(`Download complete to file '${localFilePath}'`);

  let jobInfo = yield util.getStoreValue(job_id);

  const finServerConfig = config.getFinConfig();

  Object.assign(jobInfo, {
    file_path: path.resolve(localFilePath),
    user_id: data.user_id || finServerConfig.user_id,
    tenant_id: data.tenant_id || finServerConfig.tenant_id,
    api_url: data.api_url || finServerConfig.url,
  });

  yield util.setStoreValue(job_id, jobInfo);

  this.body = {
    code: 0,
    message: 'OK',
    data: {
      job_id: job_id
    }
  };

  logger.debug(`Response to /mp/process/download: ${JSON.stringify(this.body)}`);


  yield next;
});


//
// detect the image type
// post body: {
//   job_id: '239991023123'
// }
//
// return {
//   code: 0,
//   message: 'ok',
//   data: {
//     ori_image:{
//       //ori is the uploaded image (wechat local image)
//       ori_w: 1280,
//       ori_h: 960
//     },
//     normalize_image: {
//       //the image here is the compressed image
//       w: 1100,
//       h: 784,
//       file: 'url of image',
//       extract_polygon: [{x:10,y:20}....]
//     }
//     type: {  //null if not match
//       name: 'cn_vat_sh',
//       desc: 'china vat shanghai '
//     },
//     featurePoints:[{  //coordinate is based on compressed image
//       x: 100,
//       y: 100,
//       w: 100,
//       h: 200
//       file: 'local file path of this ROI'
//     }, ...]
//   }
// }

router.post('/mp/process/detect_type', function*(next) {
  let jobId = this.request.body.job_id;

  let jobInfo = yield util.getStoreValue(jobId);

  logger.debug(`JobInfo: ${jobInfo}`);

  let data = yield rp({
    uri: `${config.getOcrServerUrl()}/api/detect_invoice`,
    body: {
      job_id: jobId,
      file_path: jobInfo.file_path,
    },
    method: 'POST',
    json: true,
  });

  logger.debug(`Received from /api/detect_invoice: ${JSON.stringify(data)}`);

  let d = data.data;
  let resType = ocrParser.isValidInvoice(d.type);
  let featurePoints = [];

  if (resType) {
    featurePoints.push({
      x: d.type.roi.x,
      y: d.type.roi.y,
      w: d.type.roi.w,
      h: d.type.roi.h,
      file: util.convertOcrServerPathToWebUrl(d.type.roi.file)
    });

    jobInfo.type = resType.name;
  }

  if (d.normalize_image) {
    jobInfo.compress_file = d.normalize_image.file;
  }

  yield util.setStoreValue(jobId, jobInfo);

  if(jobInfo.compress_file){
    //upload attachment is this step to speed up invoice creating
    //just send it, don't wait it complete
    logger.info(`Call async task to upload attachment: ${jobId}`);

    rp({
      uri: `http://localhost:${config.getHttpServerPort()}/mp/invoice/upload`,
      body: {
        job_id: jobId,
      },
      method: 'POST',
      json: true,
    });

  }



  this.body = {
    code: 0,
    message: 'OK',
    data: {
      ori_image: {
        //ori is the uploaded image (wechat local image)
        w: d.ori_image.w,
        h: d.ori_image.h,
      },
      normalize_image: (d.normalize_image ? {
          //the image here is the compressed image
          w: d.normalize_image.w,
          h: d.normalize_image.h,
          file: util.convertOcrServerPathToWebUrl(d.normalize_image.file),
          extract_polygon: d.normalize_image.extract_polygon,
        } : null),
      type: resType,
      featurePoints: featurePoints,
    },
  };

  logger.debug(`Response to /mp/process/detect_type: ${JSON.stringify(this.body)}`);

  yield next;
});


// extract the image
// post body: {
//  job_id: '239991023123'
// }
//
//return {
//  code: 0,
//  message: 'OK',
//  data: {
//    images: {
//      Customer: {
//        x: 100,
//        y: 100,
//        w: 100,
//        h: 200,
//        file: 'local file path of this ROI',
//      },
//      DocNumber, DocDate, Total, Items
//    }
//  }
//}

router.post('/mp/process/extract_image', function*(next) {
  // data.data.images: [
  //   {
  //     name: 'Customer',
  //     x: 100,
  //     y: 100,
  //     w: 100,
  //     h: 200,
  //     file: 'local file path of this ROI',
  //   },
  //   ...]
  let jobInfo = yield util.getStoreValue(this.request.body.job_id);

  let data = yield rp({
    uri: `${config.getOcrServerUrl()}/api/extract_image`,
    body: {
      job_id: this.request.body.job_id,
    },
    method: 'POST',
    json: true,
  });

  logger.debug(`Received from /api/extract_image: ${JSON.stringify(data)}`);

  //const fieldNameMap = config.getFieldNameMap();

  let extractImages = {};

  for (let image of data.data.images) {
    extractImages[image.name] = {
      x: image.x,
      y: image.y,
      w: image.w,
      h: image.h,
      file: util.convertOcrServerPathToWebUrl(image.file)
    };
  }

  if (jobInfo.type === 'cn_vat_sh') {
    if (!('Items' in extractImages)) {
      extractImages['Items'] = {
        x: 1,
        y: 1,
        w: 1,
        h: 1,
        file: null,
      };
    }
  }

  this.body = {
    code: 0,
    message: 'OK',
    data: {
      images: extractImages
    }
  };

  logger.debug(`Response to /mp/process/extract_image: ${JSON.stringify(this.body)}`);

  yield next;
});


/*
 ocr the image to text
 post body: {
 job_id: '239991023123'
 }

 return {
 code: 0,
 message: 'ok',
 data: {
 values: real value type
 }
 }
 */
router.post('/mp/process/ocr', function*(next) {

  // data.data.ocr = [
  //   {
  //     name: 'customer',
  //     value: ['line1', 'line2'...]
  //   },
  //   ...]

  let jobInfo = yield util.getStoreValue(this.request.body.job_id);

  let data = yield rp({
    uri: `${config.getOcrServerUrl()}/api/ocr`,
    body: {
      job_id: this.request.body.job_id,
    },
    method: 'POST',
    json: true,
  });

  logger.debug(`Received from /api/ocr: ${JSON.stringify(data)}`);

  let ocr = ocrParser.parseOCRResult(data.data.ocr, jobInfo.type);

  logger.debug(`OCR Converted: ${JSON.stringify(ocr)}`);

  this.body = {
    code: 0,
    message: 'OK',
    data: ocr
  };

  yield next;
});


/*
 create invoice:
 {
 job_id: '123992323232'
 invoice: {
 "DocNumber": "123123123",
 "Customer": "SAP Labs China",
 "Total": 1000.0,
 "DocDate": "2016-01-01",
 "Items": [{
 "Name": "iPhone 7",
 "Quantity": 10.0,
 "Total": 1000.0,
 }]
 }
 }

 return : {
 code: 0,
 message: 'OK',
 data: true
 }
 */
router.post('/mp/invoice/create', function*(next) {
  let data = this.request.body;

  let result = yield fin.createInvoice(data.job_id, data.invoice);

  this.body = {
    code: 0,
    message: 'OK',
    data: result
  };

  yield next;
});

// this function used to upload attachment before last step, to speed up
// when success, it will write to redis
// post body: {
//    job_id: '239991023123'
// }
// response: {
//    attachment_id: '1223'
// }
router.post('/mp/invoice/upload', function*(next) {
  let job_id = this.request.body.job_id;

  let attachment_id = yield fin.uploadAttachment(job_id);

  let jobInfo = yield util.getStoreValue(job_id);

  if (!jobInfo.finAttachmentId) {
    logger.info('Attachment ID not exist, update it')
    jobInfo.finAttachmentId = attachment_id;

    yield util.setStoreValue(job_id, jobInfo);
  } else {
    logger.info('Attachment ID already exists, ignore it')
  }


  this.body = {
    code: 0,
    message: 'OK',
    data: {
      attachment_id: attachment_id
    }
  };

  yield next;
});

router.get('/health', function*(next) {
  this.body = 'OK';

  yield next;
});

module.exports = router;