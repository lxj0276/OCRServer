import 'babel-polyfill'
import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import {Router, Route, hashHistory, IndexRoute} from 'react-router';
import urlParse from 'url-parse';

//import styles
import 'weui';
import 'react-weui/lib/react-weui.min.css';

import App from './app/App.jsx';
import HomePage from './app/HomePage.jsx';
import RecognizePage from './app/RecognizePage.jsx';
import InvoicePage from './app/InvoicePage.jsx';

class Index extends Component {
  render() {
    return (
      <Router history={hashHistory}>
        <Route path="/" component={App}>
          <IndexRoute component={HomePage}/>
          <Route path="/recognize/:localResId/:serverResId" component={RecognizePage}/>
          <Route path="/invoice/:jobId" component={InvoicePage}/>
        </Route>
      </Router>
    );
  }
}


//debug > 0 to enable debug
//debug = 1, will call ocr server, but fake wechat action
//debug = 2, local only, fake both wechat and ocr server
const url = urlParse(window.location.href, true);
window.debug = url.query.debug;

ReactDOM.render((
  <Index />
), document.getElementById('container'));