#!/usr/bin/env python
# -*- coding: utf-8 -*-


from flask import Flask
from flask_restful import Api
from restapi import ExtractImage2, Ocr2, CompressImage, DetectType2, recognize
from tornado.wsgi import WSGIContainer
from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop
import logging

logging.basicConfig(level=logging.DEBUG, format="[%(asctime)s] %(levelname)-5s %(name)-8s - %(message)s")
recognize.loadConfig()

app = Flask(__name__)


@app.route('/health')
def heath_check():
    return 'OK'


api = Api(app)

api.add_resource(DetectType2.DetectType2Api, '/api/detect_invoice')
api.add_resource(ExtractImage2.ExtractImage2Api, '/api/extract_image')
api.add_resource(Ocr2.OCR2Api, '/api/ocr')
api.add_resource(CompressImage.CompressImageApi, '/api/compress_image')

logging.debug('Load Recongize Config: %s' % str(recognize.getConfig()))

if __name__ == '__main__':
    http_server = HTTPServer(WSGIContainer(app))
    http_server.listen(5000)
    IOLoop.instance().start()
