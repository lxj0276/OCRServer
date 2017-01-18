// app.js

import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import {Router, Route, hashHistory, IndexRoute, Redirect} from 'react-router';
import urlParse from 'url-parse';


import Admin from './admin/app/Admin.jsx';
import InvoiceListPage from './admin/app/InvoiceListPage.jsx';
import DefaultProductPage from './admin/app/DefaultProductPage.jsx';
import JobPage from './admin/app/JobPage.jsx';
import QrCodePage from './admin/app/QRCodePage.jsx';

class Index extends Component {
  render() {
    return (
      <Router history={hashHistory}>
        <Redirect from="/" to="/invoices"/>
        <Route path="/" component={Admin}>
          <Route path="/invoices" component={InvoiceListPage}/>
          <Route path="/default_product" component={DefaultProductPage}/>
          <Route path="/job" component={JobPage}/>
          <Route path="/qrcode" component={QrCodePage}/>
        </Route>
      </Router>
    );
  }
}

const url = urlParse(window.location.href, true);
window.debug = url.query.debug;

ReactDOM.render((
  <Index />
), document.getElementById('container'));