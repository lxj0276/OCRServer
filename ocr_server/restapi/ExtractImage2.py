#!/usr/bin/env python
# -*- coding: utf-8 -*-
from flask import request
from flask_restful import Resource
from restapi import tools
import logging
import cv2
from restapi import recognize
import datetime

class ExtractImage2Api(Resource):
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

    def post(self):
        begin_time = datetime.datetime.now()

        json_data = request.get_json(force=True)
        job_id = json_data['job_id']

        logging.info('STEP TWO BEGIN')
        logging.info('Request: %s' % str(json_data))

        data = self.extractImage(job_id)

        res = {
            'code': 0,
            'message': 'OK',
            'data': data
        }

        logging.info('Response: %s' % str(res))
        logging.info('STEP TWO END, in %.2f seconds' % ((datetime.datetime.now() - begin_time).total_seconds(),))

        return res

    def extractImage(self, job_id):
        all_config = recognize.getConfig()

        job_data = tools.loadJobData(job_id)
        logging.debug('Load job data: %s' % str(job_data))

        cur_config = all_config[job_data['type']]
        logging.debug('Load recognize config: %s' % str(cur_config))

        img = cv2.imread(job_data['file'], cv2.IMREAD_UNCHANGED)
        img_roi_draw = img.copy()

        res_images = []

        for roi_name in cur_config['roi']:
            roi_config = cur_config['roi'][roi_name]

            if roi_config.get('hide', False):
                logging.info('Ignore roi [%s] because it is hidden' % roi_name)
                continue

            logging.info('Create roi [%s] = %s' % (roi_name, str(roi_config)))
            roi_img, roi_path = tools.createRoi2(img, roi_name, roi_config, job_id + '/step2')
            tools.drawRoi(img_roi_draw, roi_config)

            res_images.append({
                'name': roi_name,
                'x': roi_config['x'],
                'y': roi_config['y'],
                'w': roi_config['w'],
                'h': roi_config['h'],
                'file': roi_path,
            })

        tools.writeImageJob(img_roi_draw, job_id + '/step2', '1 draw roi')

        return {
            'images': res_images
        }
