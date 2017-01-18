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
} from 'antd';

import '../css/DefaultProductPage.css';


const {Column} = Table;
const {Item: FormItem} = Form;

export default class DefaultProductPage extends Component {
  state = {
    productName: ''
  }

  componentDidMount() {
    this.loadDefaultProductName()
      .then(d => {
        this.setState({
          productName: d
        });
      })
      .catch(ex => {
        this.handleError(ex);
      })
  }

  handleError(ex) {
    alert(ex);
  }

  loadDefaultProductName() {
    return new Promise((resolve, reject) => {
      $.ajax({
        type: "GET",
        url: '/admin/default_product_name',
        contentType: 'application/json',
        dataType: 'json',
      }).done(d => {
        return resolve(d.data);
      }).fail(ex => {
        return reject(ex.responseJSON);
      });
    });
  }

  updateDefaultProductName(name) {
    return new Promise((resolve, reject) => {
      $.ajax({
        type: "POST",
        url: '/admin/default_product_name',
        data: JSON.stringify({
          name: name,
        }),
        contentType: 'application/json',
        dataType: 'json',
      }).done(d => {
        return resolve(d.data);
      }).fail(ex => {
        return reject(ex.responseJSON);
      });
    });
  }


  onClickSave(e) {
    this.updateDefaultProductName(this.state.productName)
      .then(d => {
        message.success('Update successfully');
      })
      .catch(ex => {
        this.handleError(ex);
      })
  }

  handleProductNameChange(e) {
    this.setState({
      productName: e.target.value
    });
  }

  render() {
    const formItemLayout = {
      labelCol: {span: 6},
      wrapperCol: {span: 6},
    };
    const tailFormItemLayout = {
      wrapperCol: {
        span: 6,
        offset: 6,
      },
    };

    return (
      <Form horizontal>
        <FormItem label="Product Name" {...formItemLayout}>
          <Input value={this.state.productName} onChange={e => this.handleProductNameChange(e)}/>
        </FormItem>
        <FormItem {...tailFormItemLayout}>
          <Button type="primary" onClick={e => this.onClickSave(e)}>Save</Button>
        </FormItem>
      </Form>
    )
  }
}