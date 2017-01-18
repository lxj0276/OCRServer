import React, {Component} from 'react';
import $ from 'jquery';
import {hashHistory} from 'react-router';
import {Menu, Icon} from 'antd';
const SubMenu = Menu.SubMenu;

import 'antd/dist/antd.css';
import '../css/Admin.css';


export default class App extends Component {
  state = {
    finServerUrl: null,
    tenant_id: null,
    user_id: null,

    title: null
  }

  componentDidMount() {
    this.loadFinServerConfig()
      .then(d => {
        this.setState({
          finServerUrl: d.url,
          tenant_id: d.tenant_id,
          user_id: d.user_id,
        });
      })
      .catch(ex => {
        console.log(ex);
      });

    this.setTitle(this.props.location.pathname);
  }

  loadFinServerConfig() {
    return new Promise((resolve, reject) => {
      $.ajax({
        type: "GET",
        url: '/admin/config/fin',
        contentType: 'application/json',
        dataType: 'json',
      }).done(d => {
        return resolve(d);
      }).fail(ex => {
        return reject(ex.responseJSON);
      });
    });
  }

  setTitle(name){
    let nameMapping = {
      '/invoices': 'Dummy Invoices',
      '/default_product': 'Default Product Name',
      '/qrcode': 'QRCode Generator',
      '/job': 'Job History',
    };

    this.setState({
      title: nameMapping[name] || null,
    });
  }

  onClickMenuItem(e) {
    this.setTitle(e.key);
    this.gotoPage(e.key);
  }

  gotoPage(path) {
    hashHistory.push(path);
  }


  render() {
    return (
      <div className="layout-aside">
        <aside className="layout-sider">
          <div className="layout-logo">
            <h3>Scanner Management</h3>
          </div>
          <Menu mode="inline"
                theme="dark"
                onClick={e => this.onClickMenuItem(e)}
                defaultSelectedKeys={[this.props.location.pathname]}
                defaultOpenKeys={['configuration','debug']}
          >
            <SubMenu key="configuration" title={<span><Icon type="user"/>Configuration</span>}>
              <Menu.Item key="/invoices">Dummy Invoices</Menu.Item>
              <Menu.Item key="/default_product">Default Product Name</Menu.Item>
              <Menu.Item key="/qrcode">QRCode Helper</Menu.Item>
            </SubMenu>
            <SubMenu key="debug" title={<span><Icon type="laptop"/>Debug Online</span>}>
              <Menu.Item key="/job">Jobs History</Menu.Item>
            </SubMenu>
          </Menu>
          <div className="layout-sider-bottom">
            <h4>Default Setting:</h4>
            <div>Api: {this.state.finServerUrl}</div>
            <div>UID: {this.state.user_id}</div>
            <div>TID: {this.state.tenant_id}</div>
          </div>
        </aside>
        <div className="layout-main">
          <div className="layout-header">
            <h1 style={{padding: 15}}>{this.state.title}</h1>
          </div>
          <div className="layout-container">
            <div className="layout-content">
              <div style={{height: 590}}>
                {this.props.children}
              </div>
            </div>
          </div>
          <div className="layout-footer">
            SAP © 2016
          </div>
        </div>
      </div>
    );
  }
};