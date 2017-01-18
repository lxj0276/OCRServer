'use strict';

const koa = require('koa');
const koaLogger = require('koa-logger');
const koaJson = require('koa-json');
const koaBody = require('koa-body');
const koaMount = require('koa-mount');
const log4js = require('log4js');
const koaStatic = require('koa-static');
const config = require('./config');
const appRoute = require('./app_route');
const adminRoute = require('./admin_route');
const koaRewrite = require('koa-rewrite');

const logger = log4js.getLogger();

const app = koa();


app.use(koaLogger());
app.use(koaJson({pretty: true}));
app.use(koaBody());
app.use(koaRewrite('/admin', '/admin.html'));
app.use(koaRewrite('/scanner', '/index.html'));
app.use(koaStatic(config.getWebRootPath()));
app.use(koaMount(config.getImageWebRoot(), koaStatic(config.getOcrServerImageRoot())));
app.use(function*(next) {
  logger.debug('Request JSON:', JSON.stringify(this.request.body));
  yield next;
});
app.use(function *(next) {
  try {
    yield next;
  } catch (err) {
    this.status = 500;

    let errMsg = err.message || err;

    //handle error from fin-server
    if (err && err.error && err.error.message) {
      errMsg = err.error.message;
    }

    this.body = {
      code: -1,
      message: errMsg,
    };
    logger.error(err);
  }
});
app.use(appRoute.routes());
app.use(adminRoute.routes());
app.use(appRoute.allowedMethods());
app.use(adminRoute.allowedMethods());


app.listen(config.getHttpServerPort());
