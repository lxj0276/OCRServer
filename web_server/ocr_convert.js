'use strict';

const log4js = require('log4js');
const config = require('./config');
const util = require('./util');

const logger = log4js.getLogger();

const SpecialCharMap = {
  '隼': '年',
  '。': '.',
  '￥': '',
  '．': '.',
  'q': '1',
  '，': '.',
};
const NumberCharMap = {
  'n': '0',
  'o': '0',
  'O': '0',
  'i': '1',
  'I': '1',
  't': '1',
  '日': '8',
};

const AllowedNumbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.'];

const DateCharMap = {
  '年': '-',
  '月': '-',
  '日': '',
  '0': '0',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '‘': '6',
  '工': '1',
  'i': '1',
  '旧': '1',
  'z': '2',
};

const replaceSpecialChar = function (line) {
  let newLine = '';
  for (let char of line) {
    if (char in SpecialCharMap) {
      newLine += SpecialCharMap[char];
    } else {
      newLine += char;
    }
  }
  return newLine;
}

//remove space and line-break, return null if no readable text
const preProcessLine = function (line) {
  let newLine = line || "";

  newLine = newLine.trim().replace(/(\r\n|\n|\r)/gm, "");

  if (newLine.length > 0) {
    return replaceSpecialChar(newLine);
  } else {
    return null;
  }
}

//data: ['abc','def'...]
const preProcessData = function (data) {
  if (data === null) {
    return [];
  }
  let newData = [];
  for (let d of data) {
    let x = preProcessLine(d);
    if (x !== null) {
      newData.push(x);
    }
  }
  return newData;
}

//line: 'a2b0c9.323', return pure number string
const filterNumber = function (line) {
  let newLine = '';
  for (let char of line) {
    let c = char;
    if (c in NumberCharMap) {
      c = NumberCharMap[c];
    }

    if (AllowedNumbers.includes(c)) {
      newLine += c;
    }
  }

  if (newLine.length === 0) {
    return null;
  }

  return newLine;
}

const filterDate = function (line) {
  let newLine = '';
  for (let char of line) {
    if (char in DateCharMap) {
      newLine += DateCharMap[char];
    }
  }

  if (newLine.length === 0) {
    return null;
  }

  return newLine;
}

/*
 data: {
 "name": "seller",
 "value": [
 "芸鬻蠹篡，，，》，",
 "91330903098352484A",
 "舟山布普陀嘿卡家尖街道东沙假日路12朗号2号楼底层11。盍B83298’",
 "农行舟山南珍支行1g425101040鲤鲴1’一一一一一－"
 ]
 },


 businessCode = customer/date/price/number/seller

 */

const PARSER_MAP = {
  Customer: function (data) {
    let d = preProcessData(data);

    if (d.length === 0) {
      return null;
    }

    let customerName = null;

    for (let k of d) {
      if (k.includes('公司') || k.includes('有限')) {
        customerName = k;
        break;
      }
    }

    if (!customerName) {
      customerName = d[0]
    }

    if (customerName) {
      if ([...'思爱普'].reduce((preVal, curVal) => {
          return (customerName.includes(curVal) ? 1 : 0) + preVal;
        }, 0) >= 2) {
        customerName = '思爱普（中国）有限公司';
      }
    }


    return customerName;
  },
  DocDate: function (data) {
    let d = preProcessData(data);

    if (d.length === 0) {
      return null;
    }

    return filterDate(d[0]);
  },
  Total: function (data) {
    let d = preProcessData(data);

    if (d.length === 0) {
      return null;
    }

    return filterNumber(d[0]);
  },
  DocNumber: function (data) {
    let d = preProcessData(data);

    if (d.length === 0) {
      return null;
    }

    return filterNumber(d[0]);
  },
  Items: function (data) {
    let d = preProcessData(data);
    return d.join('');
  },
};

// data = [
//   {
//     name: 'customer',
//     value: ['line1', 'line2'...]
//   },
//   ...]
//
// return:
//  {
//    DocNumber,DocDate, Customer, Total,
//    Items: [{}]
//  }
const parseOCRResult = function (data, type) {
  let res = {};

  for (let ocr of data) {
    let fn = PARSER_MAP[ocr.name];
    if (fn) {
      res[ocr.name] = fn(ocr.value);
    }
  }

  if (type === 'cn_vat_sh') {
    //add default item
    res['Items'] = [{
      Name: util.getDefaultInvItemName(),
      Quantity: '1',
      Amount: res.Total || '',
    }];

    if (res.DocNumber) {
      let localInv = util.getLocalInvoice(res.DocNumber);

      if (localInv) {
        return localInv;
      }
    }
  }

  return res;
}

/*
 return {
 name: 'typename'
 } or null
 */
const isValidInvoice = function (typeData) {
  if (typeData === null) {
    return null
  }

  if (typeData.name === 'cn_vat_sh') {
    let d = preProcessData(typeData.value);

    if (d.length === 0) {
      return null;
    }

    let invTypeNum = filterNumber(typeData.value[0]);

    logger.info(`Invoice Type is ${invTypeNum}, from origin data: ${JSON.stringify(typeData.value)}`)

    if (invTypeNum !== null && invTypeNum.length === 10) {
      return {
        name: typeData.name,
        desc: typeData.desc,
      }
    }

    return null;
  } else {
    return {
      name: typeData.name,
      desc: typeData.desc,
    }
  }

}


module.exports = {
  parseOCRResult,
  isValidInvoice,
};