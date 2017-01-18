#!/usr/bin/env python
# -*- coding: utf-8 -*-
from flask import request
from flask_restful import Resource
import cv2
import numpy as np
from restapi import tools
import logging
import math


class DetectInvoiceApi(Resource):

    def detectInvoice(self, job_id, file_path):
        img = cv2.imread(file_path, cv2.IMREAD_UNCHANGED)
        origin_shape = img.shape
        logging.info('%s LOAD IMG    width:%d, height:%d' % (tools.getTempTime(), origin_shape[1], origin_shape[0]))

        img, rotate_sum = tools.findLinesandRotate(img)
        rotated_shape = img.shape
        img, img_detect, new_left_top = tools.matchAndImageCut(img)
        img_shape = img.shape
        rotate = np.deg2rad(-1*rotate_sum)
        x = new_left_top[0]-int(rotated_shape[1]/2)
        y = new_left_top[1]-int(rotated_shape[0]/2)
        newX, newY = int(np.cos(rotate)*x-np.sin(rotate)*y), int(np.cos(rotate)*y+np.sin(rotate)*x)
        origX, origY = -newY+int(origin_shape[1]/2), newX+int(origin_shape[0]/2)
        a_location, b_location = tools.detectFeaturePoints(img)
        logging.info(
            '%s IMG AFTER ROTATE AND CUT  width:%d, height:%d' % (tools.getTempTime(), img_shape[1], img_shape[0]))

        img_copy1 = img.copy()
        img_copy2 = img.copy()
        img_compress = img.copy()
        img_black = tools.exBlackWords(img_copy1)
        img_blue = tools.exBlueWords(img_copy2)
        img_black = cv2.cvtColor(img_black, cv2.COLOR_BGR2GRAY)
        img_blue = cv2.cvtColor(img_blue, cv2.COLOR_BGR2GRAY)

        cv2.rectangle(img_black, a_location[0], a_location[1], 0, 2)
        cv2.rectangle(img_black, b_location[0], b_location[1], 0, 2)
        logging.info('%s DRAW DOCTYPE TEMPLATE (%d, %d), (%d, %d)' % (
            tools.getTempTime(), a_location[0][0], a_location[0][1], a_location[1][0], a_location[1][1]))
        logging.info('%s DRAW DOCTYPE TEMPLATE (%d, %d), (%d, %d)' % (
            tools.getTempTime(), b_location[0][0], b_location[0][1], b_location[1][0], b_location[1][1]))

        # create compress image
        k = img_shape[1] / 1000.0
        compress_img = cv2.resize(img_compress, (int(img_shape[1] / k), int(img_shape[0] / k)))
        logging.info('%s COMPRESS IMAGE SAVED' % tools.getTempTime())

        # write img to file
        file_path = tools.writeImageJob(img, job_id + '/step1', '1_rotated')
        compress_path = tools.writeImageJob(compress_img, job_id + '/step1', '1_compressd')
        tools.writeImageJob(img_black, job_id + '/step1', '1_black')
        tools.writeImageJob(img_blue, job_id + '/step1', '1_blue')
        tools.writeImageJob(img_detect, job_id + '/step1', '1_detect')
        logging.info('%s ROTATED IMAGE SAVED IN %s' % (tools.getTempTime(), file_path))

        a_roi, a_path = tools.createRoi(img, a_location, job_id + '/step1', '1_type_Roi')
        b_roi, b_path = tools.createRoi(img, b_location, job_id + '/step1', '1_number_Roi')
        docType = tools.callOcr(a_roi, job_id + '/step1', img_shape[1])
        logging.info('%s CREATE TEMPLATE ROIS' % tools.getTempTime())
        logging.info('%s CALL OCR    docType: %s' % (tools.getTempTime(), docType))

        # write tickle to file for next step to use
        data = dict()
        data['feaLoca'] = [a_location, b_location]
        data['originLeftTop'] = [origX, origY]
        data['filePath'] = file_path
        data['compressPath'] = compress_path
        data['imgShape'] = img_shape
        data['originShape'] = origin_shape
        data['rotateSum'] = rotate_sum
        data['docType'] = docType
        data['feaPath'] = [a_path, b_path]
        tools.writePickle(data, job_id, 'step1')
        logging.info('%s WRITE PICKLE' % tools.getTempTime())

        return data

    def post(self):
        json_data = request.get_json(force=True)

        job_id = json_data['job_id']
        file_path = json_data['file_path']
        logging.basicConfig(level=logging.INFO)
        logging.info('%s STEP ONE BEGIN' % tools.getTempTime())
        logging.info('%s LOAD JSON DATA    job_id: %s, file_path: %s' % (tools.getTempTime(), job_id, file_path))

        result = self.detectInvoice(job_id, file_path)

        img_shape = result['imgShape']
        origin_shape = result['originShape']
        rotate_sum = result['rotateSum']
        doc_type = result['docType']
        file_path = result['compressPath']
        a_location = result['feaLoca'][0]
        b_location = result['feaLoca'][1]
        orig_left_top = result['originLeftTop']
        fea_path = result['feaPath']
        logging.info('%s CREATE JSON DATA' % tools.getTempTime())

        dummy_data = {
            'image': {
                'w': img_shape[1],
                'h': img_shape[0],
                'ori_w': origin_shape[1],
                'ori_h': origin_shape[0],
                'ori_left_top_x': orig_left_top[0],
                'ori_left_top_y':orig_left_top[1],
                'file': file_path,
                'rotate_sum':rotate_sum
            },
            'docType': doc_type,
            'featurePoints': [
                {
                    'x': a_location[0][0],
                    'y': a_location[0][1],
                    'w': a_location[1][0] - a_location[0][0],
                    'h': a_location[1][1] - a_location[0][1],
                    'file': fea_path[0],
                },
                {
                    'x': b_location[0][0],
                    'y': b_location[0][1],
                    'w': b_location[1][0] - b_location[0][0],
                    'h': b_location[1][1] - b_location[0][1],
                    'file': fea_path[1],
                }
            ]
        }
        logging.info('%s RETURN JOSN BODY' % tools.getTempTime())
        logging.info('%s STEP ONE END' % tools.getTempTime())

        return {
            'code': 0,
            'message': 'OK',
            'data': dummy_data
        }
