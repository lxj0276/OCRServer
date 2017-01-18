import React, {Component} from 'react';
import $ from 'jquery';
import {
  Table,
  Modal,
  Button,
  Form,
  Input,
  Alert,
  Popconfirm,
  message,
  Cascader,
  Col,
  Row,
  Icon,
} from 'antd';
import QRCode from 'qrcode.react';
const {Item: FormItem} = Form;

import '../css/DefaultProductPage.css';

const LocalStorageKey = 'InvScanAdminQrSetting'

export default class QRCodePage extends Component {
  state = {
    baseUrl: null,

    tenantId: null,
    userId: null,
    apiUrl: null,

    sysTenantId: null,
    sysUserId: null,
    sysApiUrl: null,
  }

  componentDidMount() {
    this.loadJobs()
      .then(d => {
        let customizeSetting = JSON.parse(window.localStorage[LocalStorageKey] || '{}');

        this.setState({
          baseUrl: d.url,
          tenantId: customizeSetting.tenantId || d.tenant_id,
          userId: customizeSetting.userId || d.user_id,
          apiUrl: customizeSetting.apiUrl || d.api_url,

          sysTenantId: d.tenant_id,
          sysUserId: d.user_id,
          sysApiUrl: d.api_url,
        })
      })
      .catch(ex => {
        this.handleError(ex);
      });
  }

  handleError(ex) {
    alert(ex);
  }

  getQrCodeValue() {
    return `${this.state.baseUrl}?tid=${this.state.tenantId}&uid=${this.state.userId}&u=${encodeURIComponent(this.state.apiUrl)}`;
  }

  isUsingCustomizedSetting() {
    if (this.state.tenantId != this.state.sysTenantId
      || this.state.userId != this.state.sysUserId
      || this.state.apiUrl != this.state.sysApiUrl) {
      return true;
    } else {
      return false;
    }
  }

  onClickSaveToLocal(e) {
    let data = {
      tenantId: this.state.tenantId,
      userId: this.state.userId,
      apiUrl: this.state.apiUrl,
    };

    window.localStorage[LocalStorageKey] = JSON.stringify(data);

    message.success('Saved in your local storage successfully!');
  }

  loadJobs() {
    return new Promise((resolve, reject) => {
      $.ajax({
        type: "GET",
        url: '/admin/config/wechat',
        contentType: 'application/json',
        dataType: 'json',
      }).done(d => {
        return resolve(d.data);
      }).fail(ex => {
        return reject(ex.responseJSON);
      });
    });
  }

  onInputChange(e, field) {
    this.setState({
      [field]: e.target.value
    });
  }

  render() {
    const formItemLayout = {
      labelCol: {span: 6},
      wrapperCol: {span: 18},
    };
    const tailFormItemLayout = {
      wrapperCol: {
        span: 14,
        offset: 6,
      },
    };

    return (
      <div>
        <Row>
          <Col span={12}>
            <Form>
              <FormItem
                {...formItemLayout}
                label="Index"
              >
                {this.state.baseUrl}
              </FormItem>

              <FormItem
                {...formItemLayout}
                label="Tenant-ID"
                hasFeedback
              >
                <Input value={this.state.tenantId} onChange={e => this.onInputChange(e, 'tenantId')}/>
              </FormItem>
              <FormItem
                {...formItemLayout}
                label="USER-ID"
                hasFeedback
              >
                <Input value={this.state.userId} onChange={e => this.onInputChange(e, 'userId')}/>
              </FormItem>
              <FormItem
                {...formItemLayout}
                label="API URL"
                hasFeedback
              >
                <Input value={this.state.apiUrl} onChange={e => this.onInputChange(e, 'apiUrl')}/>
              </FormItem>
              <FormItem {...tailFormItemLayout}>
                <p style={{color: 'Green', display: this.isUsingCustomizedSetting() ? 'inline' : 'none'}}>
                  <Icon type="exclamation-circle"/>
                  <span style={{paddingLeft: 5}}>Current config is different than defaults</span>
                </p>
                <p>
                  <Button type="primary" onClick={e => this.onClickSaveToLocal(e)}>Save as my defaults</Button>
                </p>
                <p style={{color: 'Grey'}}>
                  This will only affect your own default setting.
                </p>
              </FormItem>
            </Form>


          </Col>

          <Col span={10} offset={2}>
            <QRCode value={this.getQrCodeValue()} size={256}/>
            <p>Please use WeChat to scan</p>
          </Col>
        </Row>

      </div>
    )
  }
}