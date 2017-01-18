import React, {Component} from 'react';
import {
  Button,
  ButtonArea,
  Flex,
  FlexItem,
  Cells,
  CellsTitle,
  Cell,
  CellHeader,
  CellBody,
  CellFooter,
  Icon,
  Progress,
  LoadMore,
  Dialog,
  Msg,
  Popup,
  PopupHeader,
} from 'react-weui';
import $ from 'jquery';
import {hashHistory} from 'react-router';
import urlParse from 'url-parse';
import ScanBtn from './ScanBtn.jsx';

import '../css/RecognizePage.css';
require('../img/recognize_origin_image.jpg');

const InitState = {
  jobId: null,

  curStepName: 'upload',
  stepStatus: [{
    name: 'upload',
    state: 'pending', //state: 'pending', pending/processing/error/success
    text: 'Uploading for analysis...'
  }, {
    name: 'detect_type',
    state: 'pending',
    text: 'Detecting invoice type...'
  }, {
    name: 'extract_image',
    state: 'pending',
    text: 'Extracting key information...',
  }, {
    name: 'ocr',
    state: 'pending',
    text: 'OCR scanning...'
  }],


  complete: false,
  error: false,
  errMessage: null,

  horizontalAnim: false,  //whether horizontal the animation
  markPolygon: false,

  //oriImgXXX is the origin image (upload to wechat)
  oriImgWidth: -1,
  oriImgHeight: -1,

  //imgXXX is the normalized image
  imgWidth: -1,
  imgHeight: -1,
  imgUrl: null,
  type: null,             //the invoice type
  typeDesc: null,         //the invoice type description name
  imgExtractPolygon: [],
  detectTypeROI: [],  //[{x,y,w,h, file}]
  extractImageROI: {}, //{Customer: {x,y,w,h,file}, DocDate, Total, Customer, Items }
  ocrResult: {
    DocNumber: null,
    DocDate: null,
    Total: null,
    Customer: null,
    Items: [],
  },
};

const IMAGE_MAX_WIDTH = 250;
const IMAGE_MAX_HEIGHT = 250;

export default class RecognizePage extends Component {
  state = Object.assign({}, JSON.parse(JSON.stringify(InitState)), {
    curResHash: null,   //combine localResId & serverMediaId to detect the change
  });

  // componentWillReceiveProps(nextProps) {
  //   let newResHash = `${nextProps.params.localResId}#${nextProps.params.serverResId}`;
  //   if (newResHash !== this.state.curResHash) {
  //     this.startRecognize(newResHash);
  //   }
  // }

  componentDidMount() {
  }

  waitSeconds(millseconds = 1500) {
    return new Promise((resolve) => {
      setTimeout(() => {
        return resolve();
      }, millseconds);
    });
  }

  getResHash() {
    return `${this.props.params.localResId}#${this.props.params.serverResId}`;
  }

  startRecognize() {
    let newState = JSON.parse(JSON.stringify(InitState));

    this.setState(newState);
    this.setState({
      curResHash: this.getResHash(),
    });

    this.setStepState('upload', 'processing', newState.stepStatus);

    Promise.all([this.step1_upload(this.getServerMediaId())])
      .then(([job_id,]) => {
        this.setState({
          jobId: job_id
        });
        this.setStepState('upload', 'success');
        this.setStepState('detect_type', 'processing');
        return Promise.all([this.step2_detect_type(), this.waitSeconds()]);
      })
      .then(([{data},]) => {

        if (data.type === null) {
          throw new Error('Invalid invoice image, please scan again.')
        }

        this.setState({
          imgWidth: data.normalize_image.w,
          imgHeight: data.normalize_image.h,
          imgUrl: data.normalize_image.file,
          imgExtractPolygon: data.normalize_image.extract_polygon,

          oriImgWidth: data.ori_image.w,
          oriImgHeight: data.ori_image.h,

          detectTypeROI: data.featurePoints,
          type: data.type.name,
          typeDesc: data.type.desc,

          markPolygon: true,
        });

        window.imageUrl = data.normalize_image.file;


        return Promise.all([this.waitSeconds(2000)]);
      })
      .then(() => {
        //just add animation

        this.setStepState('detect_type', 'success');
        this.setStepState('extract_image', 'processing');


        return Promise.all([this.step3_extract_image(), this.waitSeconds()]);
      })
      .then(([{data},]) => {
        this.setStepState('extract_image', 'success');
        this.setStepState('ocr', 'processing');

        this.setState({
          extractImageROI: data.images,
        });

        return Promise.all([this.step4_ocr(), this.waitSeconds()]);
      })
      .then(([{data},]) => {
        this.setStepState('ocr', 'success');

        //ocrResult
        this.setState({
          ocrResult: data,
        });

        window.ocrResult = data;
        window.ocrImage = {};
        for (let key of Object.keys(this.state.extractImageROI)) {
          if (this.state.extractImageROI[key]) {
            window.ocrImage[key] = this.state.extractImageROI[key].file || null
          }
        }

        this.waitSeconds().then(() => {
          this.setState({
            complete: true
          });
        });

      })
      .catch((ex) => {
        this.setStepState(this.state.curStepName, 'error');

        this.setState({
          complete: false,
          error: true,
        });

        this.handleError(ex);
      });
  }

  handleError(msg) {
    console.log(msg);
    let errMsg = msg;

    if (msg && msg.message) {
      errMsg = msg.message;
    }

    this.setState({
      errMessage: errMsg
    });
  }

  //return [{x, y, w, h, file}]
  getOcrExtractROIWithValue() {
    let roi = [];
    for (let key of Object.keys(this.state.extractImageROI || {})) {
      roi.push(Object.assign({}, this.state.extractImageROI[key], {
        value: this.state.ocrResult[key] || null,
      }));
    }
    return roi;
  }

  getROI() {
    let roi = [...this.state.detectTypeROI];
    for (let key of Object.keys(this.state.extractImageROI)) {
      roi.push(this.state.extractImageROI[key]);
    }
    return roi;
  }

  getLocalResId() {
    return `${window.wxLocalResPrefix}${this.props.params.localResId}`;
  }

  getServerMediaId() {
    return this.props.params.serverResId;
  }

  getLocalImageUrl() {
    if (window.debug) {
      return 'build/images/recognize_origin_image.jpg';
    }
    return this.getLocalResId();
  }

  setStepState(name, state, stepStatus = null) {
    let newStatus = [];

    let srcStepStatus = this.state.stepStatus;

    if (stepStatus) {
      srcStepStatus = stepStatus;
    }

    for (let step of srcStepStatus) {
      if (step.name === name) {
        step.state = state;
      }

      newStatus.push(step);
    }

    this.setState({
      stepStatus: newStatus,
      curStepName: name,
    });
  }

  getProcessPercentage() {
    let percent = 20;

    for (let step of this.state.stepStatus) {
      if (step.state === 'success') {
        percent += 20;
      }
    }

    if (percent >= 100) {
      percent = 100;
    }

    return percent;
  }

  getCurrentStepText() {
    for (let step of this.state.stepStatus) {
      if (step.name === this.state.curStepName) {
        return step.text;
      }
    }

    return null;
  }

  isStepAllowAnim(name) {
    for (let step of this.state.stepStatus) {
      if (step.name === name && step.state === 'success') {
        return true;
      }
    }

    return false;
  }

  convertOriginCoordinate2DisplayCoordinate(originCoordinate) {
    let {width: disWidth, height: disHeight} = this.getAnimElemStyle();

    let wRatio = disWidth / this.state.imgWidth;
    let hRatio = disHeight / this.state.imgHeight;

    return {
      x: originCoordinate.x * wRatio,
      y: originCoordinate.y * hRatio,
      w: originCoordinate.w * wRatio,
      h: originCoordinate.h * hRatio,
    };
  }

  onClickGoInvoice() {
    hashHistory.push(`/invoice/${this.state.jobId}`);
  }

  onClickAnimArea() {
    this.setState({
      horizontalAnim: !this.state.horizontalAnim
    });
  }

  //upload image to server, let server downloading from wechat media-server
  step1_upload(serverResId) {
    if (window.debug == '2') {
      return Promise.resolve('20161228T093917X8592');
    }

    return this.callServerToDownload(serverResId);
  }

  step2_detect_type() {
    if (window.debug == '2') {

      return Promise.resolve({
        "code": 0,
        "message": "OK",
        "data": {
          "ori_image": {
            "w": 960,
            "h": 1280
          },
          "normalize_image": {
            "w": 1148,
            "h": 724,
            "file": "/images/tmp/20170102T004420X9270/step1/compressd.jpg",
            "extract_polygon": [
              {
                "x": 604,
                "y": 38
              },
              {
                "x": -84,
                "y": 254
              },
              {
                "x": 256,
                "y": 1346
              },
              {
                "x": 945,
                "y": 1133
              }
            ]
          },
          "type": //null,
            {
              "name": "cn_vat_sh",
              "desc": "中国普通增值税发票(上海2016)"
            },
          "featurePoints": [
            {
              "x": 164,
              "y": 51,
              "w": 209,
              "h": 41,
              "file": "/images/tmp/20170102T004420X9270/step1/roi-DocType.jpg"
            }
          ]
        }
      });
    }
    return new Promise((resolve, reject) => {
      $.ajax({
        type: "POST",
        url: '/mp/process/detect_type',
        data: JSON.stringify({
          job_id: this.state.jobId
        }),
        contentType: 'application/json',
        dataType: 'json',
      }).done(d => {
        return resolve(d);
      }).fail(ex => {
        return reject(ex.responseJSON);
      });
    });
  }

  step3_extract_image() {
    if (window.debug == '2') {
      return Promise.resolve({
        "code": 0,
        "message": "OK",
        "data": {
          "images": {
            "Customer": {
              "x": 216,
              "y": 163,
              "w": 432,
              "h": 101,
              "file": "/images/tmp/20170101T163426X2117/step2/roi-Customer.jpg"
            },
            "DocNumber": {
              "x": 826,
              "y": 42,
              "w": 151,
              "h": 55,
              "file": "/images/tmp/20170101T163426X2117/step2/roi-DocNumber.jpg"
            },
            "DocDate": {
              "x": 912,
              "y": 119,
              "w": 185,
              "h": 37,
              "file": "/images/tmp/20170101T163426X2117/step2/roi-DocDate.jpg"
            },
            "Total": {
              "x": 873,
              "y": 508,
              "w": 219,
              "h": 38,
              "file": "/images/tmp/20170101T163426X2117/step2/roi-Total.jpg"
            },
            "Items": {
              "x": 55,
              "y": 299,
              "w": 1038,
              "h": 113,
              "file": "/images/tmp/20170101T163426X2117/step2/roi-Items.jpg"
            }
          }
        }
      });
    }


    return new Promise((resolve, reject) => {
      $.ajax({
        type: "POST",
        url: '/mp/process/extract_image',
        data: JSON.stringify({
          job_id: this.state.jobId
        }),
        contentType: 'application/json',
        dataType: 'json',
      }).done(d => {
        return resolve(d);
      }).fail(ex => {
        return reject(ex.responseJSON);
      });
    });
  }

  step4_ocr() {
    if (window.debug == '2') {
      // alert('in debug');
      return Promise.resolve({
        "code": 0,
        "message": "OK",
        "data": {
          "Customer": "思爱普（中国）有限公司",
          "DocNumber": "08301897",
          "DocDate": "2016-12-22",
          "Total": null,
          "Items": [
            {
              "Name": "Other Item",
              "Quantity": "1",
              "Amount": ""
            }
          ]
        }
      });
    }

    return new Promise((resolve, reject) => {
      $.ajax({
        type: "POST",
        url: '/mp/process/ocr',
        data: JSON.stringify({
          job_id: this.state.jobId
        }),
        contentType: 'application/json',
        dataType: 'json',
      }).done(d => {
        return resolve(d);
      }).fail(ex => {
        return reject(ex.responseJSON);
      });
    });
  }

  //return job_id
  callServerToDownload(serverResId) {
    return new Promise((resolve, reject) => {
      const urlQuery = urlParse(window.location.href, true);

      $.ajax({
        type: "POST",
        url: '/mp/process/download',
        data: JSON.stringify({
          media_id: serverResId,
          user_id: urlQuery.query.uid || null,
          tenant_id: urlQuery.query.tid || null,
          api_url: urlQuery.query.u || null,
        }),
        contentType: 'application/json',
        dataType: 'json',
      }).done(d => {
        return resolve(d.data.job_id);
      }).fail(ex => {
        return reject(ex.responseJSON);
      });
    });
  }

  roiValue2DisplayString(value) {
    if (!value) {
      return [];
    } else if (Object.prototype.toString.call(value) === '[object Array]') {
      return value.map(i => {
        return `${i.Name} ${i.Quantity} ${i.Amount}`;
      });

    } else {
      return [value.toString()];
    }
  }

  getPolygonStyle() {
    if (this.state.imgExtractPolygon.length > 0) {
      let win_h = $(document).height();
      let win_w = $(document).width();
      let dis_w = win_w;
      let dis_h = win_w * this.state.oriImgHeight / this.state.oriImgWidth;
      let k = win_w / this.state.oriImgWidth;
      let offset_y = (win_h - dis_h) * 0.5;

      let res = [];

      for (let p of this.state.imgExtractPolygon) {
        let y = 100 * (p.y * k + offset_y) / win_h;
        let x = 100 * (p.x * k) / win_w;

        res.push(`${x}% ${y}%`);
      }

      return `polygon(${res.join(', ')})`;
    }


    return `polygon(0% 0%)`;
  }

  getAnimElemStyle() {
    let [max_w, max_h] = [IMAGE_MAX_WIDTH, IMAGE_MAX_HEIGHT];

    let k = this.state.imgWidth / this.state.imgHeight;
    let [w, h] = [max_w, max_h]

    if (k > max_w / max_h) {
      //horizontal
      h = max_w * this.state.imgHeight / this.state.imgWidth;
    } else {
      //vertical
      w = max_h * this.state.imgWidth / this.state.imgHeight;
    }


    return {
      width: w,
      height: h,
      marginLeft: -0.5 * w,
    }
  }

  render() {
    if (this.getResHash() !== this.state.curResHash) {
      this.startRecognize();

      this.setState({
        curResHash: this.getResHash(),
      });

    }

    let errorContent = null;

    if (this.state.error) {
      errorContent = (
        <Popup
          show={this.state.error !== null}
        >
          <div style={{padding: 20, textAlign: 'center'}}>
            <Flex>
              <FlexItem style={{padding: 10}}>
                <Icon size="small" value="warn"/>
                <span style={{fontSize: 16}}>Failed to recognize!</span>
              </FlexItem>
            </Flex>
            <Flex>
              <FlexItem style={{padding: 10}}>
                <div style={{color: '#888', fontSize: 14}}>{this.state.errMessage}</div>
              </FlexItem>
            </Flex>
            <Flex>
              <FlexItem>
                <ButtonArea >
                  <ScanBtn type="warn" text="Rescan"/>
                </ButtonArea>
              </FlexItem>
            </Flex>
          </div>

        </Popup>
      );
    }


    // if (this.state.error) {
    //   return ( <Msg
    //     type="warn"
    //     title="Failed to recognize!"
    //     description={this.state.errMessage}
    //     buttons={[]}
    //     footer={() => (
    //       <div style={{height: 300}}>
    //         <ButtonArea >
    //           <ScanBtn type="warn" text="Rescan"/>
    //         </ButtonArea>
    //       </div>)}
    //   />)
    //     ;
    // } else {

    let showScanning = false;

    if (['upload', 'detect_type'].includes(this.state.curStepName)) {
      showScanning = true;
    }


    return (
      <div className="page recognize-page">
        <div
          className={`inv-scanner ${showScanning ? 'scanning' : ''} ${this.state.markPolygon ? 'show-polygon' : ''}`}
          style={{backgroundImage: `url(${this.getLocalImageUrl()})`}}>
          <div className="inv-scanner-polygon"
               style={{clipPath: this.getPolygonStyle(), WebkitClipPath: this.getPolygonStyle()}}></div>
          <div className="inv-scanner-overlay" style={{opacity: this.state.error ? 0 : 1}}/>
          <div className="inv-scanner-title">
            <LoadMore loading>{this.getCurrentStepText()}</LoadMore>
          </div>
          <div className="inv-scanner-detect-name">
            <Icon value="success"/>
            <span>{this.state.typeDesc}</span>
          </div>
        </div>


        <div>
          <div className={`recognize-title ${showScanning ? 'scanning' : ''}`}>
            {this.state.complete ?
              (
                <h3>Invoice recognized</h3>
              ) : (
                <h3>Extracting and recognizing...</h3>
              )
            }
          </div>
          <div
            className={`inv-anim  ${showScanning ? 'scanning' : ''} ${this.state.complete && !this.state.horizontalAnim ? 'complete' : ''}`}
            onClick={e => this.onClickAnimArea(e)}>
            {/*<div className={`anim-elem layer-1 ${this.isStepAllowAnim('upload') ? 'transform' : ''}`}>*/}
            {/*<img className='origin-img' src={this.getLocalImageUrl()} ref="refOriginImg"/>*/}
            {/*</div>*/}
            <div className={`anim-elem layer-2 ${this.isStepAllowAnim('detect_type') ? 'transform' : ''}`}
                 style={
                   Object.assign(this.getAnimElemStyle(), {
                     backgroundImage: `url(${this.state.imgUrl})`,
                   })
                 }>
              <div className="layer-2-mask"></div>
            </div>
            <div className={`anim-elem layer-3 ${this.isStepAllowAnim('extract_image') ? 'transform' : ''}`}
                 style={
                   Object.assign(this.getAnimElemStyle(), {})
                 }>
              {
                this.getROI().map((roi, i) => {
                  let cood = this.convertOriginCoordinate2DisplayCoordinate(roi);
                  return (
                    <img key={i}
                         className="roi-rect"
                         src={roi.file}
                         style={{
                           left: cood.x,
                           top: cood.y,
                           width: cood.w,
                           height: cood.h,
                         }}/>
                  );
                })
              }
            </div>
            <div className={`anim-elem layer-4 ${this.isStepAllowAnim('ocr') ? 'transform' : ''}`}
                 style={
                   Object.assign(this.getAnimElemStyle(), {})
                 }>
              {
                this.getOcrExtractROIWithValue().map((roi, i) => {
                  let cood = this.convertOriginCoordinate2DisplayCoordinate(roi);
                  return roi.value ? (
                      <div key={i}
                           className="roi-rect"
                           src={roi.file}
                           style={{
                             left: cood.x,
                             top: cood.y,
                             width: cood.w,
                             height: cood.h,
                           }}
                      >
                        <div className="roi-rect-text">
                          {this.roiValue2DisplayString(roi.value).map(v => {
                            return (<p>{v}</p>);
                          })}
                        </div>
                      </div>
                    ) : null;
                })
              }
            </div>
          </div>


          <div className={`recognize-sample ${this.state.complete && !this.state.horizontalAnim ? 'complete' : ''}`}>
            <CellsTitle><span>{this.state.typeDesc}</span></CellsTitle>
            <Cells>
              {['DocNumber', 'Customer', 'DocDate', 'Total'].map(fieldName => {
                return this.state.ocrResult[fieldName] ? (
                    <Cell key={fieldName}>
                      <CellBody>
                        {this.state.ocrResult[fieldName]}
                      </CellBody>
                    </Cell>)
                  : null;
              })}
            </Cells>
          </div>

          <div className={`recognize-info ${showScanning ? 'scanning' : ''}`}>
            <Progress value={this.getProcessPercentage()} showCancel={false}/>
            {this.state.complete ? (
                <div style={{
                  padding: '1.5em',
                  textAlign: 'center',
                  fontSize: 14
                }}>
                  <Icon value="success"/>
                  <span style={{padding: 2}}>Completed!</span>
                </div>
              ) : (
                <LoadMore loading>{this.getCurrentStepText()}</LoadMore>
              )}
          </div>
          <div className={`recognize-buttons ${showScanning ? 'scanning' : ''}`}>
            <ButtonArea direction="horizontal">
              <ScanBtn disabled={!this.state.complete} type="default" text="Rescan"/>
              <Button onClick={ e => this.onClickGoInvoice(e) } disabled={!this.state.complete}>
                Continue
              </Button>
            </ButtonArea>
          </div>
          {errorContent}
        </div>
      </div>
    );
    // }
  }
};