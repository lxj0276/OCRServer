#!/usr/bin/env python
# -*- coding: utf-8 -*-
from flask import Flask, jsonify, request
from flask_restful import reqparse, abort, Api, Resource
from restapi import tools
import logging
import cv2


class OCRApi(Resource):
    '''
    input:{
      job_id: 'the id of this job'
    }

    response:
    {
        code: 0,
        message: 'OK',
        data: {
            ocr: [
            {
                name: 'customer',
                value: ['line1', 'line2'...]
            },
            ...]
        }
    }

    '''

    def ocr(self, job_id):

        picData = tools.readPickle(job_id, 'step2')
        images = picData['images']['Points']
        file_path = picData['filePath']
        logging.info('%s LOAD DATA FROM PICKLE')

        img = cv2.imread(file_path, cv2.IMREAD_UNCHANGED)
        img_shape = img.shape
        logging.info('%s LOAD IMG    width: %d, height: %d' % (tools.getTempTime(), img_shape[1], img_shape[0]))

        datas = []
        for image in images.items():
            data = dict()
            data['name'] = image[0]
            ocrTemp, _ = tools.createRoi(img, image[1], job_id + '/step3', '3_' + image[0] + '_Roi')
            if data['name'] in ('customer', 'date'):
                data['value'] = tools.callOcr(ocrTemp, job_id + '/step3', img_shape[1], 1992)
            else:
                data['value'] = tools.callOcr(ocrTemp, job_id + '/step3', img_shape[1])
            datas.append(data)
            logging.info('%s CALL COR FOR BLOCK %s    result: %s' % (tools.getTempTime(), data['name'], data['value']))

        return datas

    def post(self):
        json_data = request.get_json(force=True)
        job_id = json_data['job_id']
        logging.basicConfig(level=logging.INFO)
        logging.info('%s STEP THREE BEGIN' % tools.getTempTime())
        logging.info('%s LOAD JSON DATA    job_id: %s' % (tools.getTempTime(), job_id))

        result = self.ocr(job_id)

        ocrs = []
        for data in result:
            ocr = dict()
            ocr['name'] = data['name']
            ocr['value'] = data['value']
            ocrs.append(ocr)
        logging.info('%s RETURN JOSN BODY' % tools.getTempTime())
        logging.info('%s STEP THREE END' % tools.getTempTime())

        dummy_data = {
            'ocr': ocrs
        }

        return {
            'code': 0,
            'message': 'OK',
            'data': dummy_data
        }
