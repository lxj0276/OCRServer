'use strict';


const util = require('./util');
const config = require('./config');
const log4js = require('log4js');
const uuidV1 = require('uuid/v1');
const rp = require('request-promise');
const fs = require('fs');
const restler = require('restler');
const dateFormat = require('dateformat');

const logger = log4js.getLogger();


const uploadAttachment = function*(job_id) {
  let jobInfo = yield util.getStoreValue(job_id);

  logger.info(`Uploading local file: ${jobInfo.compress_file}`);

  //let finConfig = config.getFinConfig();
  let uploadUrl = `${jobInfo.api_url}/invoice/api/Attachments/v1`;

  //DEBUG
  //if(job_id === '20161226T172356X8000'){
  //  jobInfo.file_path = '/Users/i064027/Desktop/4.jpg';
  //}

  if(!jobInfo.compress_file){
    logger.error(`File path in jobId=${job_id} doesn't exists`);
    throw new Error(`JobID doesn't exists. You may already expired, please refresh and try again.`);
  }

  let stats = fs.statSync(jobInfo.compress_file);

  logger.info(`Upload file ${jobInfo.compress_file} ( size = ${stats.size} ) start...`)


  return new Promise((resolve, reject) => {
    restler.post(uploadUrl, {
      multipart: true,
      data: {
        "filename": restler.file(jobInfo.compress_file, null, stats.size, null, "image/jpg")
      },
      headers: {
        'user-id': jobInfo.user_id,
        'tenant-id': jobInfo.tenant_id,
        'correlation-id': uuidV1(),
      }
    }).on("complete", function (data) {
      logger.info(` upload file complete, response: ${JSON.stringify(data)}`);


      if (data && data.content) {
        let result = data.content;

        if (result.statusCode === 200) {

          let body = result.body;
          if (typeof body === 'string') {
            try {
              body = JSON.parse(body);
            } catch (e) {
            }
          }

          if (body.id) {
            return resolve(body.id.toString());
          }
        }
      }

      if (data && data.content) {
        return reject(data.content.body);
      } else {
        return reject(data);
      }
    });
  });
}

const strTofloat = function (val) {
  let fVal = val;
  if (typeof fVal === 'string') {
    try {
      fVal = parseFloat(val);
    } catch (ex) {
      fVal = 0.0;
    }
  }

  return fVal;
}

//
// {
//   "DocNumber": "123123123",
//   "Customer": "SAP Labs China",
//   "Total": 1000.0,
//   "DocDate": "2016-01-01",
//   "Items": [{
//   "Name": "iPhone 7",
//   "Quantity": 10.0,
//   "UnitPrice": 100,
//   "Amount": 1000.0,
// }]
// }
const createInvoice = function*(job_id, data) {
  let jobInfo = yield util.getStoreValue(job_id);

  //jobInfo.finAttachmentId = '127083965341696';

  if (!jobInfo.finAttachmentId) {
    jobInfo.finAttachmentId = yield uploadAttachment(job_id);

    yield util.setStoreValue(job_id, jobInfo);
  }

  logger.info(`Attachment ID = ${jobInfo.finAttachmentId}`);

  let today = dateFormat(new Date(), 'yyyy-mm-dd');
  let currency = 'RMB';


  let postData = {
    "number": data.DocNumber,
    "type": "ITEM",
    "businessPartner": {
      "name": data.Customer,
    },
    "pricingMethod": "GROSS",
    "currencyCode": currency,
    "dueDate": today,
    "documentDate": data.DocDate,
    "grossTotal": {
      "currencyCode": currency,
      "value": strTofloat(data.Total),
    },
    "photoAttachmentId": jobInfo.finAttachmentId,
    "lines": data.Items ? data.Items.map((item, i) => {
      return {
        "lineNumber": i,
        "calcBase": "AMOUNT",
        'warehouse': {
          "code": "whs01"
        },
        "item": {
          "name": item.Name,
        },
        "quantity": {
          "value": strTofloat(item.Quantity),
        },
        "grossAmount": {
          "currencyCode": currency,
          "value": strTofloat(item.Amount),
        }
      }
    }) : [],
  };

  //for general product line
  if(postData.lines.length === 1){
    if(!postData.lines[0].grossAmount.value){
      postData.lines[0].grossAmount.value = postData.grossTotal.value;
    }
  }

  // let finConfig = config.getFinConfig();
  let correlationId = uuidV1();
  let createUrl = `${jobInfo.api_url}/invoice/api/ARInvoices/Drafts`;


  logger.info(`Post to FIN Server [${createUrl}] (${correlationId}, user-id=${jobInfo.user_id}, tenant-id=${jobInfo.tenant_id}): ${JSON.stringify(postData)}`);

  let result = yield rp({
    uri: createUrl,
    body: postData,
    method: 'POST',
    json: true,
    headers: {
      'user-id': jobInfo.user_id,
      'tenant-id': jobInfo.tenant_id,
      'correlation-id': correlationId,
    }
  });

  logger.info(`Result from create invoice: ${JSON.stringify(result)}`);

  return true;
}

module.exports = {
  createInvoice,
  uploadAttachment,
};