import React, {Component} from 'react';
import {
  Popup,
  PopupHeader,
  Form,
  FormCell,
  CellHeader,
  CellBody,
  Button,
  CellsTitle,
  Label,
  Input,
  ButtonArea,
  Agreement,
} from 'react-weui';
import {hashHistory} from 'react-router';



const DEBUG_MEDIA_ID = '4OzkAy-vFFn7fqycZFKwtJgUjDICJz9WkHuBDk_COPxCKlVBTexkJ3NFCeT1zSyS';
const DEBUG_LOCAL_ID = 'wxLocalResource://504082172068825';



export default class ScanBtn extends Component {
  static defaultProps = {
    type: 'primary',
    text: 'Scan',
    disabled: false,
  }


  onClickScan(e) {
    if (window.debug) {
      const rid = Math.floor(Math.random() * 1000000);
      return this.gotoRecognizePage(`${DEBUG_LOCAL_ID}${rid}`, DEBUG_MEDIA_ID);
    }

    wx.chooseImage({
      count: 1,
      sizeType: ['original'], //original,compressed
      sourceType: ['album', 'camera'],
      success: res => {
        this.uploadToWechat(res.localIds[0]);
      }
    });
  }

  uploadToWechat(imgLocalId) {
    wx.uploadImage({
      localId: imgLocalId,
      isShowProgressTips: 1,
      success: (res) => {
        this.gotoRecognizePage(imgLocalId, res.serverId);
      }
    });
  }

  gotoRecognizePage(localResId, resourceId) {
    /*
     iOS and Android is different at localResId:
     iOS: wxLocalResource://123456
     Android: weixin://resourceid/123456

     when detect os type, we store in global environment
     */

    let prefixIdx = localResId.lastIndexOf('/');
    let ld = localResId.substr(prefixIdx + 1);
    window.wxLocalResPrefix = localResId.substr(0, prefixIdx + 1);

    if(ld){
      hashHistory.push(`/recognize/${ld}/${resourceId}`);
    }else{
      alert(`Invalid localIds: ${localResId}`);
    }
  }

  render() {
    return (
      <Button type={this.props.type} onClick={e=>this.onClickScan(e)} disabled={this.props.disabled}>{this.props.text}</Button>
    )
  }


};