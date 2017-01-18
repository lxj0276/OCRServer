#!/usr/bin/env python
# -*- coding: utf-8 -*-
from flask import request
from flask_restful import Resource
from restapi import tools
import logging
import cv2


class ExtractImageApi(Resource):
    '''
    input:{
      job_id: 'the id of this job'
    }

    response:
    {
        code: 0,
        message: 'OK',
        data: {
            images: [
            {
                name: 'customer',
                x: 100,
                y: 100,
                w: 100,
                h: 200,
                file: 'local file path of this ROI',
            },
            ...]
        }
    }
    '''

    def extractImage(self, job_id):
        # read img
        picData = tools.readPickle(job_id, 'step1');
        feaLocas = picData['feaLoca']
        a = feaLocas[0]
        b = feaLocas[1]
        file_path = picData['filePath']
        logging.info('%s LOAD DATA FROM PICKLE' % tools.getTempTime())

        img = cv2.imread(file_path, cv2.IMREAD_UNCHANGED)
        rare_img = img.copy()
        img_shape = img.shape
        logging.info('%s LOAD IMG    width: %d, height: %d' % (tools.getTempTime(), img_shape[1], img_shape[0]))

        datas = dict()
        points = dict()
        paths = dict()
        datas['Points'] = points
        datas['Paths'] = paths
        points['customer'] = tools.findCustomerRect(a[0], a[1], b[0], b[1])
        points['number'] = tools.findNumberRect(a[0], a[1], b[0], b[1])
        points['date'] = tools.findDateRect(a[0], a[1], b[0], b[1])
        # points['seller'] = tools.findSellerRect(a[0], a[1], c[0], c[1])
        points['price'] = tools.findPriceRect(a[0], a[1], b[0], b[1])
        points['lines'] = tools.findLineRect(a[0], a[1], b[0], b[1])
        logging.info('%s DIVIDE THE BLOCKS' % tools.getTempTime())

        picData = dict()
        picData['images'] = datas
        picData['filePath'] = file_path

        for point in points.items():
            _, path = tools.createRoi(img, point[1], job_id + '/step2', '2_' + point[0] + '_Roi')
            cv2.rectangle(rare_img, point[1][0], point[1][1], 0, 2)
            paths[point[0]] = path
        tools.writeImageJob(rare_img, job_id + '/step2', '2_divided_img')
        logging.info('%s CREATE DIVIDED BLOCK ROIS' % tools.getTempTime())
        logging.info('%s SAVE ROIS TO FILE' % tools.getTempTime())

        tools.writePickle(picData, job_id, 'step2')
        logging.info('%s WRITE PICKLE' % tools.getTempTime())

        return datas

    def post(self):
        json_data = request.get_json(force=True)
        job_id = json_data['job_id']
        logging.basicConfig(level=logging.INFO)
        logging.info('%s STEP TWO BEGIN' % tools.getTempTime())
        logging.info('%s LOAD JSON DATA    job_id: %s' % (tools.getTempTime(), job_id))

        result = self.extractImage(job_id)
        logging.info('%s CREATE JSON DATA' % tools.getTempTime())

        images = []
        points = result['Points']
        paths = result['Paths']
        for data in points.items():
            image = dict()
            image['name'] = data[0]
            image['x'] = data[1][0][0]
            image['y'] = data[1][0][1]
            image['w'] = data[1][1][0] - data[1][0][0]
            image['h'] = data[1][1][1] - data[1][0][1]
            image['file'] = paths[data[0]]
            images.append(image)

        dummy_data = {
            'images': images
        }
        logging.info('%s RETURN JOSN BODY' % tools.getTempTime())
        logging.info('%s STEP TWO END' % tools.getTempTime())

        return {
            'code': 0,
            'message': 'OK',
            'data': dummy_data
        }
