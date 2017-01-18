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
} from 'antd';

import '../css/DefaultProductPage.css';


const {Column} = Table;
const {Item: FormItem} = Form;

export default class JobPage extends Component {
  state = {
    productName: '',
    imageNode: [],
    imageUrl: null,
  }

  componentDidMount() {
    this.loadJobs()
      .then(d => {
        this.setState({
          imageNode: d.children || [],
        });
      })
      .catch(ex => {
        this.handleError(ex);
      });
  }

  handleError(ex) {
    alert(ex);
  }

  loadJobs() {
    return new Promise((resolve, reject) => {
      $.ajax({
        type: "GET",
        url: '/admin/jobs',
        contentType: 'application/json',
        dataType: 'json',
      }).done(d => {
        return resolve(d.data);
      }).fail(ex => {
        return reject(ex.responseJSON);
      });
    });
  }

  onChange(sel) {
    let url = sel[sel.length - 1];

    console.log(url);

    this.setState({
      imageUrl: url,
    });


  }

  render() {
    return (
      <div>
        <span>Choose Job: </span>
        <Cascader options={this.state.imageNode}
                  onChange={v => this.onChange(v)}
                  style={{width: 500}}
        />
        <div>
          <img src={this.state.imageUrl} style={{border: '1px solid Grey', marginTop: 20}}/>
        </div>
      </div>

    )
  }
}