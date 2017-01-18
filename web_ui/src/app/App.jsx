import React, {Component} from 'react';
import $ from 'jquery';
import {
  Footer,
  FooterText,
  Toast,
  Msg,
  Flex,
  FlexItem,
} from 'react-weui';

import '../css/App.css';

export default class App extends Component {
  constructor(...args) {
    super(...args);
  }

  state = {
    errType: null,  //'requireSubscribe' 'other'
    errMsg: null,
    isWechatReady: false,
  }

  componentDidMount() {
    let self = this;
    let verifyUrl = window.location.href.replace(window.location.hash, '');

    //get signature from server
    $.ajax({
      type: "POST",
      url: '/mp/jsapi_signature',
      data: JSON.stringify({
        url: verifyUrl
      }),
      contentType: 'application/json',
      dataType: 'json',
    }).done(function (wx_config) {

      wx_config.debug = window.debug;
      wx_config.jsApiList = ['chooseImage', 'previewImage', 'uploadImage', 'downloadImage'];

      wx.config(wx_config);
      wx.ready(function (res) {
        // alert(`wechat ready: ${res}`);
        self.setState({
          isWechatReady: true,
        });
      });
      wx.error(function (res) {
        // alert(`Wechat Error: ${JSON.stringify(res)}`);

        if (res.errMsg && res.errMsg === 'config:require subscribe') {
          self.setState({
            errType: 'requireSubscribe',
            errMsg: JSON.stringify(res),
          });
        } else {
          self.setState({
            errType: 'other',
            errMsg: JSON.stringify(res),
          });
        }
      });

    }).fail(function (ex) {
      self.setState({
        errType: 'other',
        errMsg: JSON.stringify(ex),
      });
    });
  }

  render() {
    // alert(`ready: ${this.state.isWechatReady}, error: ${this.state.errType}`);
    if (this.state.errType === 'requireSubscribe') {
      return (
        <div style={{padding: 20, textAlign: 'center', marginTop: 20}}>
          <Flex>
            <FlexItem>
              <h3>Error!</h3>
              <h4>You must subscribe first</h4>
            </FlexItem>
          </Flex>
          <Flex>
            <FlexItem> <img src='qrcode/qrcode.jpg' style={{width: '80%', margin: 10}}/> </FlexItem>
          </Flex>
          <Flex>
            <FlexItem style={{textAlign: 'left'}}>
              <h4>Please follow these steps:</h4>
              <p>1. Subscribe Account (Long click the QRCode and subscribe)</p>
              <p>2. Refresh whole page</p>
            </FlexItem>
          </Flex>
        </div>
      );
    } else if (this.state.errType === null) {
      if (this.state.isWechatReady) {
        return this.props.children;
      } else {
        return (
          <Toast icon="loading" show={!this.state.isWechatReady}>Authorizing...</Toast>
        )
      }
    } else {
      return (
        <Msg
          type="warn"
          title="WeChat Error"
          description={this.state.errMsg}
        />
      );
    }
  }
};