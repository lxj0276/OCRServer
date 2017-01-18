#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import request
from flask_restful import Resource
import cv2
import numpy as np
from restapi import tools
import logging
from restapi import recognize
import datetime


class DetectType2Api(Resource):
    '''
    'ori_image': {
        # ori_w, ori_h is the origin image without any change (uploaded by wechat)
        'w': ori_image.shape[1],
        'h': ori_image.shape[0],
    },
    'normalize_image': {
        # w, h, file: normalized image (roate,resize, perspective)
        'w': int(perspective_img.shape[1]) if perspective_img is not None else None,
        'h': int(perspective_img.shape[0]) if perspective_img is not None else None,
        'file': compress_path,
        'extract_polygon': [{x: 100,y:200}, ..],        # here is a list of points which describe the polygon that wraps the normalized image
    },
    'type':{
        'name': cur_match_type_name,
        'desc': display name
        'value': orc_result,
        'roi': {
            'x': validate_roi_config['x'],
            'y': validate_roi_config['y'],
            'w': validate_roi_config['w'],
            'h': validate_roi_config['h'],
            'file': validate_roi_path
        }
    }

    '''

    def post(self):
        json_data = request.get_json(force=True)

        begin_time = datetime.datetime.now()

        logging.info('STEP ONE BEGIN')
        logging.info('Request: %s' % str(json_data))

        job_id = json_data['job_id']
        file_path = json_data['file_path']

        img = cv2.imread(file_path, cv2.IMREAD_UNCHANGED)

        if img.shape[0] > 1500 or img.shape[1] > 1500:
            # if image is too big, resize to small one
            max_wh = max(img.shape[0], img.shape[1])
            k = max_wh / float(1280)

            img = cv2.resize(img, (int(img.shape[1] / k), int(img.shape[0] / k)), interpolation=cv2.INTER_AREA)

            logging.info('Image is too big, resize to small size = %s' % ((img.shape[1], img.shape[0]),))

        res = {
            'code': 0,
            'message': 'OK',
            'data': self.detectType(img, job_id)
        }

        logging.info('Response: %s' % str(res))
        logging.info('STEP ONE END, in %.2f seconds' % ((datetime.datetime.now() - begin_time).total_seconds(),))

        return res

    def make_error_response(self, ori_image):
        return {
            'ori_image': {
                'w': ori_image.shape[1],
                'h': ori_image.shape[0],
            },
            'normalize_image': None,
            'type': None
        }

    # detect image, find the right type in recognize configuration
    def detectType(self, image, job_id):
        config = recognize.getConfig()

        ############################################
        # 1. find matched type and config
        ############################################
        grey = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        logging.info("Start match...")

        # if multi-type is matched, using highest match rate as the matched one.
        # TODO: highest match rate is not preciseness, should be improved here

        cur_match_type_name = None
        cur_match_rate = -1
        cur_match_M = None
        cur_polygons = None

        logging.debug("Start match feature")

        sift = cv2.xfeatures2d.SIFT_create()
        ori_kp, ori_des = sift.detectAndCompute(grey, None)

        for type_name in config:
            match_rate, detect_img, perspective_M, polygons = self.matchAndImageCut(sift, grey,
                                                                                    ori_kp, ori_des,
                                                                                    type_name,
                                                                                    config[type_name]['feature'],
                                                                                    config[type_name]['image'],
                                                                                    job_id)

            if match_rate > 0:
                logging.info("[%s] is matched, rate = %s" % (type_name, match_rate))
                tools.writeImageJob(detect_img, job_id + '/step1', '1 match [%s] detect' % type_name)
                # tools.writeImageJob(cut_img, job_id + '/step1', '1 match [%s] cut' % type_name)

                if match_rate > cur_match_rate:
                    cur_match_rate = match_rate
                    cur_match_type_name = type_name
                    cur_match_M = perspective_M
                    cur_polygons = polygons

            else:
                logging.info("[%s] is not matched" % type_name)

        logging.debug("End match feature")

        if not cur_match_type_name:
            logging.info("No feature matched")
            return self.make_error_response(image)

        logging.info("Match [%s] at %.2f%%, M=%s" % (cur_match_type_name, cur_match_rate, cur_match_M))

        ############################################
        # 2. rotate the image
        # TODO: should support different kink of rotate/perspective way.
        ############################################
        cur_config = config[cur_match_type_name]
        perspective_img = None

        if cur_config['rotate'] == 'perspective':
            perspective_img = cv2.warpPerspective(image, cur_match_M,
                                                  (cur_config['image']['w'], cur_config['image']['h']),
                                                  flags=cv2.INTER_LANCZOS4)

            tools.writeImageJob(perspective_img, job_id + '/step1', '2 perspective-%s' % cur_match_type_name)
        else:
            logging.error('rotate %s is not supported' % cur_config['rotate'])
            return self.make_error_response(image)

        # draw all roi in img
        perspective_draw_img = perspective_img.copy()
        for roiName in cur_config['roi']:
            tools.drawRoi(perspective_draw_img, cur_config['roi'][roiName])

        tools.writeImageJob(perspective_draw_img, job_id + '/step1', '3 mark roi')

        ############################################
        # 3. extract the vaildate area
        ############################################
        validate_roi_name = cur_config['vaildate']['roi']

        validate_roi_config = cur_config['roi'].get(validate_roi_name, None)

        if not validate_roi_config:
            logging.error('Validate ROI[%s] not exist in roi section' % validate_roi_name)

        validate_roi, validate_roi_path = tools.createRoi2(perspective_img, validate_roi_name, validate_roi_config,
                                                           job_id + '/step1')
        orc_result = tools.callOcr(validate_roi, job_id + '/step1', validate_roi_config)

        logging.info('Validate ROI OCR result = %s' % orc_result)

        ############################################
        # 4. create compress jpg image
        ############################################
        compress_path = tools.writeImageJob(perspective_img, job_id + '/step1', 'compressd', quality='compress')
        normlize_path = tools.writeImageJob(perspective_img, job_id + '/step1', 'normlized', quality='lossless')

        ############################################
        # 5. write to yaml
        ############################################
        data = {
            'file': normlize_path,
            'type': cur_match_type_name
        }

        tools.saveJobData(data, job_id)

        logging.info('Save to data.yaml: %s' % str(data))

        return {
            'ori_image': {
                # ori_w, ori_h is the origin image without any change (uploaded by wechat)
                'w': image.shape[1],
                'h': image.shape[0],
            },
            'normalize_image': {
                # w, h, file: normalized image (roate,resize, perspective)
                'w': int(perspective_img.shape[1]) if perspective_img is not None else None,
                'h': int(perspective_img.shape[0]) if perspective_img is not None else None,
                'file': compress_path,
                'extract_polygon': cur_polygons,
            },
            # the detected image type and its value based, the roi is based on normalized image
            # if not match, set None
            'type': {
                'name': cur_match_type_name,
                'desc': cur_config.get('name', cur_match_type_name),
                'value': orc_result,
                'roi': {
                    'x': validate_roi_config['x'],
                    'y': validate_roi_config['y'],
                    'w': validate_roi_config['w'],
                    'h': validate_roi_config['h'],
                    'file': validate_roi_path
                }
            }
        }

        # return {
        #     'image': {
        #         # w, h, file: normalized image (roate,resize, perspective)
        #         'w': perspective_img.shape[1],
        #         'h': perspective_img.shape[0],
        #         'file': compress_path,
        #
        #         # ori_w, ori_h is the origin image without any change (uploaded by wechat)
        #         'ori_w': image.shape[1],
        #         'ori_h': image.shape[0],
        #
        #         # TODO: add polyline points which wrapper the image
        #     },
        #     # the detected image type and its value based, the roi is based on normalized image
        #     # if not match, set None
        #     'type': {
        #         'name': cur_match_type_name,
        #         'value': orc_result,
        #         'roi': {
        #             'x': validate_roi_config['x'],
        #             'y': validate_roi_config['y'],
        #             'w': validate_roi_config['w'],
        #             'h': validate_roi_config['h'],
        #             'file': validate_roi_path
        #         }
        #     }
        # }

    def matchAndImageCut(self, sift, origin, ori_kp, ori_des, typeName, featureConfig, imageConfig, job_id):
        # TODO: check file exists
        img_template = cv2.imread(featureConfig['file'], cv2.IMREAD_GRAYSCALE)

        img_detect = origin.copy()

        min_match_count = featureConfig['option'].get('minMatchCount', 50)
        distance_threshold = featureConfig['option'].get('matchDistance', 0.5)

        tpl_kp, tpl_des = sift.detectAndCompute(img_template, None)

        index_params = dict(algorithm=0, trees=5)  # algorithm = FLANN_INDEX_KDTREE
        search_params = dict(checks=50)

        flann = cv2.FlannBasedMatcher(index_params, search_params)

        matches = flann.knnMatch(tpl_des, ori_des, k=2)

        # store all the good matches as per Lowe's ratio test.
        good = []
        for m, n in matches:
            if m.distance < distance_threshold * n.distance:
                good.append(m)

        logging.info("Feature [%s] matches %s, min=%s, threshold=%.2f, good=%s" % (
            typeName, len(matches), min_match_count, distance_threshold, len(good)))

        if len(good) > min_match_count:
            src_pts = np.float32([tpl_kp[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
            dst_pts = np.float32([ori_kp[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)

            M, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)

            # draw feature polyline in origin image
            pts = np.float32([[0, 0], [0, img_template.shape[0] - 1],
                              [img_template.shape[1] - 1, img_template.shape[0] - 1],
                              [img_template.shape[1] - 1, 0]]).reshape(-1, 1, 2)
            dst = cv2.perspectiveTransform(pts, M)

            cv2.polylines(img_detect, [np.int32(dst)], True, 0, 1)

            # draw detected image
            matchesMask = mask.ravel().tolist()
            draw_params = dict(matchColor=(0, 255, 0),  # draw matches in green color
                               singlePointColor=None,
                               matchesMask=matchesMask,  # draw only inliers
                               flags=2)

            draw_img = cv2.drawMatches(img_template, tpl_kp, origin, ori_kp, good, None, **draw_params)
            tools.writeImageJob(draw_img, job_id + '/step1', 'draw matching %s' % typeName)


            # draw normalize image's polyline in origin image

            normalized_pts = np.float32([
                [-1 * featureConfig['x'], -1 * featureConfig['y']],
                [-1 * featureConfig['x'], imageConfig['h'] - featureConfig['y'] - 1],
                [imageConfig['w'] - featureConfig['x'] - 1, imageConfig['h'] - featureConfig['y'] - 1],
                [imageConfig['w'] - featureConfig['x'] - 1, -1 * featureConfig['y']]]) \
                .reshape(-1, 1, 2)

            normalized_dst = cv2.perspectiveTransform(normalized_pts, M)
            cv2.polylines(img_detect, [np.int32(normalized_dst)], True, 0, 2)

            # add offset to src_pts so that it can create right matrix
            for p in src_pts:
                p[0][0] += featureConfig.get('x', 0)
                p[0][1] += featureConfig.get('y', 0)

            M2, mask2 = cv2.findHomography(dst_pts, src_pts, cv2.RANSAC, 5.0)

            normalized_polygons = []
            for d in np.int32(normalized_dst).tolist():
                normalized_polygons.append({
                    'x': d[0][0],
                    'y': d[0][1]
                })



            return float(len(good)) / float(len(matches)), img_detect, M2, normalized_polygons
        else:
            return 0, None, None, None
