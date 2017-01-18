"use strict";

import React, {Component} from 'react';
import {hashHistory} from 'react-router';
import {
  Button,
  ButtonArea,
  Flex,
  FlexItem,
  Form,
  FormCell,
  Cell,
  Cells,
  CellHeader,
  CellBody,
  CellsTitle,
  CellFooter,
  Label,
  Input,
  TextArea,
  Msg,
  Gallery,
  Toast,
  Dialog,
  Popup,
  Agreement,
  Icon,
  Toptips,
} from 'react-weui';
import $ from 'jquery';
import ScanBtn from './ScanBtn.jsx';
import '../css/InvoicePage.css';
require('../img/recognize_origin_image.jpg');

const MSG_VALID_OK = 'OK';
const MSG_VALID_NOT_NULL = (fieldName) => `"${fieldName}" is mandatory`;

/*
 Validation Rule:
 it should return a function fn(val), and return {valid: true/false, message: 'the error message'}
 */
const validRuleText = function (fieldName, {required = false} = {}) {
  return (val) => {
    if (required && (val === '' || val === null || val === undefined)) {
      return {
        valid: false,
        message: MSG_VALID_NOT_NULL(fieldName),
      }
    }

    return {
      valid: true,
      message: MSG_VALID_OK,
    }
  }
}
const validRuleDate = function (fieldName, {required = false} = {}) {
  return (val) => {
    if (required && (val === '' || val === null || val === undefined)) {
      return {
        valid: false,
        message: MSG_VALID_NOT_NULL(fieldName),
      }
    }

    //valid format

    let parts = val.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4 && parts[1].length === 2 && parts[2].length === 2) {
        if (!isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
          let year = parseInt(parts[0]);
          let month = parseInt(parts[1]);
          let day = parseInt(parts[2]);

          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return {
              valid: true,
              message: MSG_VALID_OK,
            }
          }
        }
      }
    }

    return {
      valid: false,
      message: `"${fieldName}" is an invalid date format`,
    }

  }
}
const validRuleCurrency = function (fieldName, {required = false} = {}) {
  return (val) => {
    if (required && (val === '' || val === null || val === undefined)) {
      return {
        valid: false,
        message: MSG_VALID_NOT_NULL(fieldName),
      }
    }

    if (!isNaN(val)) {
      return {
        valid: true,
        message: MSG_VALID_OK,
      }
    }

    return {
      valid: false,
      message: `"${fieldName}" is an invalid number format`,
    }
  };
}


export default class InvoicePage extends Component {
  state = {
    invState: 'draft', //'draft','pending', 'success', 'fail'
    errMessage: null,

    showEditor: false,
    editorText: '',
    editorImage: null,
    editorFieldName: null,
    editorFieldTitle: null,

    showWarnTips: false,
    textWarnTips: null,

    data: window.ocrResult, //{DocNumber, DocDate, Total, Customer, Items:[Name, Quantity, Amount]}
    ocrImage: window.ocrImage, //{DocNumber, DocDate, Total, Customer, Items}
    originImageUrl: window.imageUrl,
  }

  fieldValidRule = {
    DocNumber: validRuleText('Inv. No', {required: true}),
    Customer: validRuleText('Customer', {required: true}),
    DocDate: validRuleDate('Inv. Date', {required: true}),
    Total: validRuleCurrency('Total Amount', {required: true}),
  }


  getJobId() {
    return this.props.params.jobId;
  }

  onClickCreateInvoice(e) {
    if (!this.validAllFields()) {
      return;
    }

    this.setState({
      invState: 'pending',
      errMessage: null,
    });

    $.ajax({
      type: "POST",
      url: '/mp/invoice/create',
      data: JSON.stringify({
        job_id: this.getJobId(),
        invoice: this.state.data,
      }),
      contentType: 'application/json',
      dataType: 'json',
    }).done(d => {
      this.setState({
        invState: 'success'
      });
    }).fail(ex => {
      let errMsg = ex.responseJSON || {};

      if (errMsg && errMsg.message) {
        errMsg = errMsg.message;
      }

      this.setState({
        invState: 'fail',
        errMessage: errMsg,
      });
    });
  }

  onClickThumbnailImg(e) {
    if (wx && wx.previewImage) {
      let url = `${window.location.origin}${this.state.originImageUrl}`;
      wx.previewImage({
        current: url,
        urls: [url],
      });
    }
  }

  onClickMsgOk(e) {
    hashHistory.push(`/`);
  }

  onClickHideDialog(e) {
    this.setState({
      invState: 'draft',
    });
  }

  onCloseEditor(e) {
    this.setState({
      showEditor: false
    })
  }

  onEditorCorrect(e) {
    let d = Object.assign({}, this.state.data, {
      [this.state.editorFieldName]: this.state.editorText
    });

    this.setState({
      data: d,
      showEditor: false,
    });
  }

  onClickHeaderCell(e, fieldName, fieldTitle) {
    this.setState({
      showEditor: true,
      editorText: this.state.data[fieldName] || '',
      editorImage: this.state.ocrImage[fieldName] || null,
      editorFieldName: fieldName || null,
      editorFieldTitle: fieldTitle,
    });
  }

  handleEditorTextChange(e) {
    this.setState({
      editorText: e.target.value
    });
  }

  isFieldValid(fieldName) {
    return this.getFieldValid(fieldName).valid;
  }

  getFieldValid(fieldName) {
    if (fieldName in this.fieldValidRule) {
      let res = this.fieldValidRule[fieldName](this.state.data[fieldName]);

      if (res) {
        return res;
      }
    }
    return {
      valid: true,
      message: MSG_VALID_OK,
    };
  }

  validAllFields() {
    for (let fieldName of Object.keys(this.state.data)) {
      let validRes = this.getFieldValid(fieldName);

      if (validRes.valid === false) {
        this.setState({
          showWarnTips: true,
          textWarnTips: validRes.message,
        });

        setTimeout(() => {
          this.setState({
            showWarnTips: false,
          });
        }, 3000);

        return false;
      }
    }

    return true;
  }

  render() {
    let showContent = ['draft', 'pending', 'fail'].includes(this.state.invState);

    if (showContent) {

      let lineDetailCells = null;

      if (this.state.data.Items) {

        lineDetailCells = (
          <div>
            <CellsTitle>Invoice Line Details</CellsTitle>
            <Cells>
              {
                this.state.data.Items.map((line, i) => {
                  return (
                    <Cell key={i}>
                      <CellBody>
                        {line.Name}
                      </CellBody>
                      <CellFooter>
                        {line.Amount}
                      </CellFooter>
                    </Cell>
                  );
                })
              }
            </Cells>
          </div>
        );
      }

      let editorValid = this.getFieldValid(this.state.editorFieldName);

      return (
        <div className="page">
          <Flex style={{padding: 15, paddingBottom: 0}}>
            <FlexItem>
              <h3 style={{whiteSpace: 'nowrap'}}>Recognized Invoice</h3>
              <p style={{color: 'Grey', fontSize: 12}}>You can edit information before creating the invoice.</p>
            </FlexItem>
            <FlexItem style={{textAlign: 'right'}}>
              <img src={this.state.originImageUrl}
                   onClick={e => this.onClickThumbnailImg(e)}
                   style={{width: '50%'}}/>
            </FlexItem>
          </Flex>


          <CellsTitle>Invoice Header</CellsTitle>
          <Cells>
            <Cell access onClick={e => this.onClickHeaderCell(e, 'DocNumber', 'Inv. No.')}>
              <CellBody>
                Inv. No.
              </CellBody>
              <CellFooter>
                {
                  this.isFieldValid('DocNumber')
                    ? ''
                    : (<Icon value="warn"/>)
                }
                <span>{this.state.data.DocNumber || null}</span>
              </CellFooter>
            </Cell>
            <Cell access onClick={e => this.onClickHeaderCell(e, 'DocDate', 'Inv. Date')}>
              <CellBody>
                Inv. Date
              </CellBody>
              <CellFooter>
                {
                  this.isFieldValid('DocDate')
                    ? ''
                    : (<Icon value="warn"/>)
                }
                <span>{this.state.data.DocDate || null}</span>
              </CellFooter>
            </Cell>
            <Cell access onClick={e => this.onClickHeaderCell(e, 'Customer', 'Customer')}>
              <CellBody>
                Customer
              </CellBody>
              <CellFooter>
                {
                  this.isFieldValid('Customer')
                    ? ''
                    : (<Icon value="warn"/>)
                }
                <span>{this.state.data.Customer || null}</span>
              </CellFooter>
            </Cell>
            <Cell access onClick={e => this.onClickHeaderCell(e, 'Total', 'Total Amount')}>
              <CellBody>
                Total Amount
              </CellBody>
              <CellFooter>
                {
                  this.isFieldValid('Total')
                    ? ''
                    : (<Icon value="warn"/>)
                }
                <span>{this.state.data.Total || null}</span>
              </CellFooter>
            </Cell>
          </Cells>

          {lineDetailCells}

          <ButtonArea direction="horizontal">
            <ScanBtn text="Rescan" type="default"/>
            <Button onClick={ e => this.onClickCreateInvoice(e) }>
              Create
            </Button>
          </ButtonArea>

          <Toast icon="loading" show={this.state.invState === 'pending'}>Creating...</Toast>
          <Dialog title="Failed to create draft invoice"
                  buttons={[{
                    type: 'default',
                    label: 'Rescan',
                    onClick: e => this.onClickMsgOk(e),
                  }, {
                    type: 'primary',
                    label: 'OK',
                    onClick: e => this.onClickHideDialog(e),
                  }]} show={this.state.invState === 'fail'}>
            <span style={{color: '#e64340'}}>{this.state.errMessage}</span>
          </Dialog>

          <Popup
            show={this.state.showEditor}
            onRequestClose={e => this.onCloseEditor(e)}
          >
            <div className="ocr-icon-popup-body">
              <CellsTitle>
                <div>
                  <span style={{float: 'left', width: '40%'}}>{this.state.editorFieldTitle}</span>
                  <span style={{float: 'right', color: 'red', width:'60%'}}>{editorValid.valid ? '' : editorValid.message}</span>
                  <div style={{clear: 'both'}}></div>
                </div>
              </CellsTitle>
              <Form>
                <FormCell>
                  <CellHeader>
                    <Label>Image</Label>
                  </CellHeader>
                  <CellBody>
                    <img src={this.state.editorImage} style={{width: '100%'}}/>
                  </CellBody>
                </FormCell>

                <FormCell>
                  <CellHeader>
                    <Label>Extracted</Label>
                  </CellHeader>
                  <CellBody>
                    <Input type="text" value={this.state.editorText} onChange={e => this.handleEditorTextChange(e)}/>
                  </CellBody>
                </FormCell>
              </Form>

              <Agreement>
                &nbsp;&nbsp; Help improve the accuracy (<a href="javascript:;">Terms and Privacy</a>)
              </Agreement>

              <div style={{margin: 20}}>
                <ButtonArea direction="horizontal">
                  <Button type="default" onClick={e => this.onCloseEditor(e)}>Close</Button>
                  <Button onClick={e => this.onEditorCorrect(e)}>Save</Button>
                </ButtonArea>
              </div>
            </div>
          </Popup>
          <Toptips type="warn" show={this.state.showWarnTips}>{this.state.textWarnTips}</Toptips>

        </div>
      )
    } else {
      if (this.state.invState === 'success') {
        return (
          <Msg
            type="success"
            title="Invoice Created Successfully "
            description="We have created a draft invoice for you. Please view it in your application."
            buttons={[{
              type: 'primary',
              label: 'OK',
              onClick: e => this.onClickMsgOk(e),
            }]}
          />
        )
      }
    }
  }
};