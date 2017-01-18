#!/usr/bin/env python
# -*- coding: utf-8 -*-
from flask import Flask, jsonify, request
from flask_restful import reqparse, abort, Api, Resource
from restapi import tools
import logging
import cv2
from restapi import recognize
import datetime

class OCR2Api(Resource):
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

    def post(self):
        begin_time = datetime.datetime.now()

        json_data = request.get_json(force=True)
        job_id = json_data['job_id']

        logging.info('STEP THREE BEGIN')
        logging.info('Request: %s' % str(json_data))

        res_ocr = self.ocr(job_id)

        res = {
            'code': 0,
            'message': 'OK',
            'data': {
                'ocr': res_ocr
            }
        }

        logging.info('Response: %s' % str(res))
        logging.info('STEP THREE END, in %.2f seconds' % ((datetime.datetime.now() - begin_time).total_seconds(),))

        return res

    def ocr(self, job_id):
        all_config = recognize.getConfig()

        job_data = tools.loadJobData(job_id)
        logging.debug('Load job data: %s' % str(job_data))

        cur_config = all_config[job_data['type']]
        logging.debug('Load recognize config: %s' % str(cur_config))

        img = cv2.imread(job_data['file'], cv2.IMREAD_UNCHANGED)

        res_orc = []

        for roi_name in cur_config['roi']:
            roi_config = cur_config['roi'][roi_name]

            if roi_config.get('hide', False):
                logging.info('Ignore roi [%s] because it is hidden' % roi_name)
                continue

            roi_orc_data = {
                'name': roi_name,
                'value': None,
            }

            if roi_config.get('ocr', True):
                roi_value_type = roi_config.get('type', 'text')

                if roi_value_type not in tools.OCR_TYPE_MAPPING:
                    logging.error('ROI Type %s not exist, skipped' % roi_value_type)
                    continue

                roi_img, roi_path = tools.createRoi2(img, roi_name, roi_config, job_id + '/step3')
                roi_orc_data['value'] = tools.callOcr(roi_img, job_id + '/step3', roi_config)

                logging.info('OCR for roi [%s, type=%s] = %s' % (roi_name, roi_value_type, roi_orc_data['value']))

            res_orc.append(roi_orc_data)

        return res_orc
