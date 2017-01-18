#!/usr/bin/env python
# -*- coding: utf-8 -*-

import cv2
import numpy as np
import os
import random
import requests
import pickle
import json
import time
import math
import logging
from collections import defaultdict
import yaml
import pytesseract
import PIL
import builtins

# Configuration here
TMP_DIR = './tmp'

OCRKey = 'Kjqbt2AWkL33thiVsm7qHm'
OCRSecret = '193f0b971ea24fbf9fcefd556225cb22'
OCRUrl = 'http://netocr.com/api/recog.do'

# code > 0, using netocr.com
# code = -1, using tesseract as number

OCR_TYPE_MAPPING = {
    'text': {
        'code': 1992,
        'prefix': './template/text_prefix_cn.png',
    },
    'number': {
        'code': -1,  # long weibo text,3992
        'prefix': './template/text_prefix_en.png',
    },
    'date': {
        'code': 1992,
        'prefix': './template/text_prefix_cn.png',
    },
    'currency': {
        'code': -1, #1991
        'prefix': './template/text_prefix_en.png',
    }
}
DEFAULT_ROI_TYPE = 'text'

ROI_STYLE_BLACK_FONT = 'black-font'
ROI_STYLE_BLUE_FONT = 'blue-font'
ROI_STYLE_BLUE_FONT_ENHANCE = 'blue-font-enhance'

DEFAULT_ROI_STYLE = ROI_STYLE_BLACK_FONT


def rotateAndScale(img, scaleFactor=1, degreesCCW=30, flags=cv2.INTER_CUBIC):
    (oldY, oldX, channels) = img.shape  # note: numpy uses (y,x) convention but most OpenCV functions use (x,y)
    M = cv2.getRotationMatrix2D(center=(oldX / 2, oldY / 2), angle=degreesCCW,
                                scale=scaleFactor)  # rotate about center of image.

    # choose a new image size.
    newX, newY = oldX * scaleFactor, oldY * scaleFactor
    # include this if you want to prevent corners being cut off
    r = np.deg2rad(degreesCCW)
    newX, newY = (abs(np.sin(r) * newY) + abs(np.cos(r) * newX), abs(np.sin(r) * newX) + abs(np.cos(r) * newY))

    # the warpAffine function call, below, basically works like this:
    # 1. apply the M transformation on each pixel of the original image
    # 2. save everything that falls within the upper-left "dsize" portion of the resulting image.

    # So I will find the translation that moves the result to the center of that region.
    (tx, ty) = ((newX - oldX) / 2, (newY - oldY) / 2)
    M[0, 2] += tx  # third column of matrix holds translation, which takes effect after rotation.
    M[1, 2] += ty

    return cv2.warpAffine(img, M, dsize=(int(newX), int(newY)), flags=flags)


def findLinesandRotate(origin):
    if origin.shape[0] > origin.shape[1]:
        origin = rotateAndScale(origin, degreesCCW=90, flags=cv2.INTER_CUBIC)

    logging.info('%s BEGIN FIND LINES AND ROTATE')

    rotate_sum = 0.0

    unchangedOrigin = origin.copy()

    for i in range(5):
        img = origin.copy()
        edges = cv2.Canny(img, 10, 200)

        minLineLength = 100
        maxLineGap = 20

        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 100, minLineLength, maxLineGap)
        logging.info('FIND LINES AMOUNT : %i' % len(lines[:, 0]))

        thetas = []
        for x1, y1, x2, y2 in lines[:, 0]:
            cv2.line(img, (x1, y1), (x2, y2), (0, 1, 0), 20)
            k = (x2 - x1) / float(y2 - y1) if y1 != y2 else 0
            if abs(k) < 1:
                thetas.append(round(math.atan(k) * 180 / math.pi, 2))

        thetas_dict = defaultdict(int)
        for theta in thetas:
            if theta >= 0:
                thetas_dict[str(theta)] += 1

        thetas_sorted = [k for k, value in sorted(thetas_dict.items(), key=lambda i: i[1], reverse=True)]
        max_thetas = float(thetas_sorted[0])
        if max_thetas == 0:
            break

        origin = rotateAndScale(origin, degreesCCW=-1 * max_thetas, flags=cv2.INTER_CUBIC)
        logging.info('ROTATE : %f' % max_thetas)
        rotate_sum += max_thetas

    unchangedOrigin = rotateAndScale(unchangedOrigin, degreesCCW=-1 * rotate_sum, flags=cv2.INTER_CUBIC)

    return unchangedOrigin, rotate_sum


def matchAndImageCut(origin):
    img_template = cv2.imread('template/h3.jpg', 0)
    img_detect = cv2.cvtColor(origin.copy(), cv2.COLOR_BGR2GRAY)

    MIN_MATCH_COUNT = 1

    # Initiate SIFT detector
    sift = cv2.xfeatures2d.SIFT_create()

    # find the keypoints and descriptors with SIFT
    kp1, des1 = sift.detectAndCompute(img_template, None)
    kp2, des2 = sift.detectAndCompute(img_detect, None)

    FLANN_INDEX_KDTREE = 0
    index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
    search_params = dict(checks=50)

    flann = cv2.FlannBasedMatcher(index_params, search_params)

    matches = flann.knnMatch(des1, des2, k=2)

    # store all the good matches as per Lowe's ratio test.
    good = []
    for m, n in matches:
        if m.distance < 0.5 * n.distance:
            good.append(m)

    if len(good) > MIN_MATCH_COUNT:
        src_pts = np.float32([kp1[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
        dst_pts = np.float32([kp2[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)

        M, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
        matchesMask = mask.ravel().tolist()

        h, w = img_template.shape
        pts = np.float32([[0, 0], [0, h - 1], [w - 1, h - 1], [w - 1, 0]]).reshape(-1, 1, 2)
        dst = cv2.perspectiveTransform(pts, M)

        cv2.polylines(img_detect, [np.int32(dst)], True, 0, 1)

    else:
        logging.info("Not enough matches are found - %d/%d" % (len(good), MIN_MATCH_COUNT))
        matchesMask = None
        return matchesMask

    left_top = int(dst[0][0][0]), int(dst[0][0][1])
    right_bottom = int(dst[2][0][0]), int(dst[2][0][1])
    W = right_bottom[0] - left_top[0]
    img_shape = origin.shape
    new_left_top = max(0, left_top[0] - int(0.35 * W)), left_top[1]
    new_right_bottom = min(img_shape[1], right_bottom[0] + int(0.56 * W)), min(img_shape[0], left_top[1] + int(1.1 * W))

    cut_img = origin[new_left_top[1]:new_right_bottom[1], new_left_top[0]:new_right_bottom[0]]

    return cut_img, img_detect, new_left_top


def detectFeaturePoints(origin):
    rare_img = origin.copy()

    img_black = exBlackWords(rare_img)
    img_black = cv2.cvtColor(img_black, cv2.COLOR_BGR2GRAY)
    logging.info('EXTRACT BLACK AND BULE WORDS')
    logging.info('GRAY')

    a_location = findTemplateRect(img_black, 'template/template_a.jpg')
    b_location = findTemplateRect(img_black, 'template/number_template.jpg')

    return a_location, b_location


# remove this because logging will automatically add timestamp
# def getTempTime():
#     return time.asctime(time.localtime(time.time()))

# remove this; because we use loadJobData() and saveJobData() as yaml instead
# def readPickle(job_id, stepName, type='txt'):
#     dirName = TMP_DIR + '/' + job_id
#     fileName = dirName + '/' + stepName + '.' + type
#
#     f = open(fileName, encoding='utf-8')
#     data = yaml.safe_load(f)
#     f.close()
#
#     return data
#
#
# def writePickle(data, job_id, stepName, type='txt'):
#     dirName = TMP_DIR + '/' + job_id
#     fileName = dirName + '/' + stepName + '.' + type
#
#
#     if not os.path.exists(dirName):
#         os.makedirs(dirName)
#
#     yaml.safe_dump({fileName: data}, default_flow_style=False, encoding='utf-8')



# quanlity = normal, lossless, compress
def writeImageJob(img, job_id, stepName, type='jpg', quality='normal'):
    dirName = TMP_DIR + '/' + job_id
    fileName = dirName + '/' + stepName + '.' + type

    if not os.path.exists(dirName):
        os.makedirs(dirName)

    if quality == 'compress':
        cv2.imwrite(fileName, img, [cv2.IMWRITE_JPEG_QUALITY, 60])
    elif quality == 'lossless':
        cv2.imwrite(fileName, img, [cv2.IMWRITE_JPEG_QUALITY, 100])
    elif quality == 'normal':
        cv2.imwrite(fileName, img)
    else:
        logging.error('Quality %s not exist' % quality)

    return os.path.abspath(fileName)


def createRoi(img, location, job_id, roi_name):
    # save data rect in roi
    roi = img[location[0][1]:location[1][1], location[0][0]:location[1][0]]
    # sharpen
    # kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
    # roi = cv2.filter2D(roi, -1, kernel)
    # extract text from background

    writeImageJob(roi, job_id, 'before extract %s' % roi_name)
    roi = extractText2BlackImage(roi)
    path = writeImageJob(roi, job_id, roi_name)
    return roi, path


original_open = open


def bin_open(filename, mode='rb'):  # note, the default mode now opens in binary
    return original_open(filename, mode)


def callOcr(roi, job_id, roi_config):
    roi_type = roi_config.get('type', DEFAULT_ROI_TYPE)
    type_config = OCR_TYPE_MAPPING.get(roi_type)

    line_count = roi_config.get('line', 1)

    line_count = line_count * roi.shape[0] / float(roi_config['h'])

    ocr_img = wrapTextImageWithPrefix(roi, line_count, type_config)

    if type_config['code'] == -1:
        # tesseract as number
        # workaround for unicode bug: http://stackoverflow.com/questions/34293274/unicodedecodeerror-with-tesseract-ocr-in-python
        try:
            builtins.open = bin_open
            ipl_img = PIL.Image.fromarray(cv2.cvtColor(ocr_img, cv2.COLOR_BGR2RGB))
            t_bts = pytesseract.image_to_string(ipl_img, lang='eng')

            t_str = str(t_bts, 'cp1252', 'ignore')

            logging.info('OCR Tesseract: %s' % str(t_str))

            text_lines = []
            for line in t_str.split("\n"):
                trim_line = line.strip()
                if trim_line != '':
                    # remove prefix and surfix
                    if trim_line.find(u"中中") < 0 and trim_line.find(u"dddd") < 0:
                        text_lines.append(trim_line)

            return text_lines
        finally:
            builtins.open = original_open

    elif type_config['code'] > 0:
        return ocrTextImage(ocr_img, job_id, type_config['code'])
    else:
        logging.error('Unknown roi type code %s' % type_config['code'])

        return ''


def exBlackWords(img):
    img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    ret, img = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

    #
    # blue, green, red = img.T
    #
    # threshold = 100
    # black_areas = (red < threshold) & (green < threshold) & (blue < threshold)
    # white_areas = (red >= threshold) | (green >= threshold) | (blue >= threshold)
    # img[...,][black_areas.T] = (0, 0, 0)  # Transpose back needed
    # img[...,][white_areas.T] = (255, 255, 255)
    #
    # return img


#
#
# def exBlueWordsOrigin(img):
#     # version on origin image
#     blue, green, red = img.T
#
#     factor = 1.2
#     black_areas = (blue < 200) & (blue > red * factor) & (blue > green * factor)
#     white_areas = ~ black_areas
#     img[:, :][black_areas.T] = (0, 0, 0)  # Transpose back needed
#     img[:, :][white_areas.T] = (255, 255, 255)  # Transpose back needed
#
#     return img

#
# def exBlueWords(img):
#     # sharpen
#     kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
#     img = cv2.filter2D(img, -1, kernel)
#
#     # version on sharpen image
#     blue, green, red = img.T
#
#     factor = 1.5
#     black_areas = (blue < 200) & (red < 100) & (green < 100) | ((blue > red * factor) & (blue > green * factor))
#     white_areas = ~ black_areas
#     img[:, :][black_areas.T] = (0, 0, 0)  # Transpose back needed
#     img[:, :][white_areas.T] = (255, 255, 255)  # Transpose back needed
#
#     return img


def extractText2BlackImage(img, roi_style=DEFAULT_ROI_STYLE, job_id=None, roi_name=None):
    # img = cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 11, 2)
    # img = cv2.GaussianBlur(img, (3, 3), 0)
    # img = cv2.medianBlur(img, 3)
    # writeImageJob(img, '1', 'blur' )

    if roi_style == ROI_STYLE_BLACK_FONT:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        ret, img = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    elif roi_style == ROI_STYLE_BLUE_FONT_ENHANCE:
        img2 = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        img2 = cv2.Canny(img2, 30, 130)
        writeImageJob(img2, job_id, 'roi-%s-canny' % roi_name)

        # kernel = np.ones((5, 5), np.uint8)
        h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 1))

        img2 = cv2.dilate(img2, h_kernel, iterations=2)
        writeImageJob(img2, job_id, 'roi-%s-dilate' % roi_name)

        img2, contours, hierarchy = cv2.findContours(img2, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        max_area = -1
        max_rect = None  # (x,y,w,h)
        # img2 = cv2.drawContours(img2, contours, -1, 150, 3)
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > max_area:
                max_area = area
                max_rect = cv2.boundingRect(cnt)

        if max_rect:
            img_contour = img[max_rect[1]:max_rect[1] + max_rect[3], max_rect[0]:max_rect[0] + max_rect[2]]

            writeImageJob(img_contour, job_id, 'roi-%s-findContours' % roi_name)

            kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
            img_contour = cv2.filter2D(img_contour, -1, kernel)

            writeImageJob(img_contour, job_id, 'roi-%s-sharpen' % roi_name)

            img_contour = cv2.cvtColor(img_contour, cv2.COLOR_BGR2GRAY)

            ret, img_contour = cv2.threshold(img_contour, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            return cv2.cvtColor(img_contour, cv2.COLOR_GRAY2BGR)

        else:
            return img
    elif roi_style == ROI_STYLE_BLUE_FONT:
        kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
        img = cv2.filter2D(img, -1, kernel)

        writeImageJob(img, job_id, 'roi-%s-sharpen' % roi_name)

        # try otsu
        img2 = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        ret, img2 = cv2.threshold(img2, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        # writeImageJob(img2, job_id, 'roi-%s-otsu' % roi_name)

        return cv2.cvtColor(img2, cv2.COLOR_GRAY2BGR)

    logging.error('Unknown roi style %s' % roi_style)

    return None


    # make black
    #
    # blue = image[:, :, 0]
    # green = image[:, :, 1]
    # red = image[:, :, 2]
    #
    # # version on origin image
    # # factor = 1.2
    # # black_areas = (blue < 200) & (blue > red * factor) & (blue > green * factor)
    # # white_areas = ~ black_areas
    # # customer_roi[:, :][black_areas] = (0, 0, 0)  # Transpose back needed
    # # customer_roi[:, :][white_areas] = (255, 255, 255)  # Transpose back needed
    #
    # # version on sharpen image
    # factor = 1.5
    # black_areas = (blue < 200) & (red < 100) & (green < 100) | ((blue > red * factor) & (blue > green * factor))
    # white_areas = ~ black_areas
    # image[:, :][black_areas] = (0, 0, 0)  # Transpose back needed
    # image[:, :][white_areas] = (255, 255, 255)  # Transpose back needed
    #
    # return image


# because ORC can't recognize small text, so we will add pre-defined text before & after the origin text-image.
def wrapTextImageWithPrefix(image, line_count, type_config):
    prefix_img = cv2.imread(type_config['prefix'], cv2.IMREAD_COLOR)

    # TODO: currently, we assume image is one line text, so we will scale based on height of image. Next step is support multi-line image
    # resize the prefix image
    prefix_img = cv2.resize(prefix_img, (
        int(prefix_img.shape[1] * image.shape[0] / (prefix_img.shape[0] * line_count)),
        int(image.shape[0] / line_count)
    ))

    prefix_height = prefix_img.shape[0]
    prefix_width = prefix_img.shape[1]

    maxWidth = max(prefix_width, image.shape[1])
    text_image = np.zeros((image.shape[0] + prefix_height * 2, maxWidth, 3), np.uint8)
    text_image[:] = (255, 255, 255)

    text_image[0:prefix_height, 0: prefix_width] = prefix_img
    text_image[-1 * prefix_height:, 0: prefix_width] = prefix_img
    text_image[prefix_height: prefix_height + image.shape[0], 0:image.shape[1]] = image

    return text_image


# call OCR service to get pure text list (each list item for a line)
# return None if error, else return text
def ocrTextImage(image, job_id, type_id=1991, first=1):
    # TODO: file should sequence increase
    ocr_file = writeImageJob(image, job_id, 'ocr_' + str(random.randint(1000000, 9999999)))

    # send request to OCR
    files = {'file': open(ocr_file, 'rb')}
    data = {'key': OCRKey, 'secret': OCRSecret, 'typeId': type_id, 'format': 'json'}

    r = requests.post(OCRUrl, files=files, data=data)

    if r.status_code == 200:
        d = json.loads(r.text)

        text_lines = []

        if d['message'] and d['message']['status'] == 0:
            for item in d['cardsinfo'][0]['rowitems']:
                line = ""
                for row_context in item['rowContext']:
                    if row_context['charValue']:
                        line += row_context['charValue']['content']

                trim_line = line.strip()
                if trim_line != '':
                    # remove prefix and surfix
                    if trim_line.find(u"中中") < 0 and trim_line.find(u"dddd") < 0:
                        text_lines.append(trim_line)

            return text_lines

        elif first:
            logging.basicConfig(level=logging.INFO)
            logging.info('FIRST OCR FAILED')
            return ocrTextImage(image, job_id, type_id, 0)
        else:
            logging.info('FIRST OCR FAILED')

    return None


def findCustomerRect(a_top_left, a_right_bottom, b_top_left, b_right_bottom):
    W = a_right_bottom[0] - a_top_left[0]
    H = a_right_bottom[1] - a_top_left[1]

    new_left_top = a_top_left[0] + int(W / 4), a_top_left[1] + int(H * 3.9)
    new_right_bottom = new_left_top[0] + int(2.3 * W), new_left_top[1] + H * 2

    return new_left_top, new_right_bottom


def findDateRect(a_top_left, a_right_bottom, b_top_left, b_right_bottom):
    H = b_right_bottom[1] - b_top_left[1]
    W = b_right_bottom[0] - b_top_left[0]

    new_left_top = b_right_bottom[0] + 4 * W, b_right_bottom[1] + int(H * 1.3)
    new_right_bottom = new_left_top[0] + 6 * W, new_left_top[1] + int(H * 1.3)
    return new_left_top, new_right_bottom


def findNumberRect(a_top_left, a_right_bottom, b_top_left, b_right_bottom):
    H = b_right_bottom[1] - b_top_left[1]
    W = b_right_bottom[0] - b_top_left[0]

    new_top_left = b_right_bottom[0] + int(W / 4), b_top_left[1] - int(H / 4)
    new_right_bottom = b_right_bottom[0] + int(6.5 * W), b_right_bottom[1] + int(H / 4)
    return new_top_left, new_right_bottom


def findPriceRect(a_left_top, a_right_bottom, b_top_left, b_right_bottom):
    H = b_right_bottom[1] - b_top_left[1]
    W = b_right_bottom[0] - b_top_left[0]
    a_W = a_right_bottom[0] - a_left_top[0]

    new_left_top = b_top_left[0] + W * 3, a_left_top[1] + int(a_W * 2.45)
    new_right_bottom = new_left_top[0] + 7 * W, new_left_top[1] + int(H * 1.5)
    return new_left_top, new_right_bottom


# def findSellerRect(a_top_left, a_right_bottom, c_top_left, c_right_bottom):
#     W = a_right_bottom[0] - a_top_left[0]
#     H = a_right_bottom[1] - a_top_left[1]
#
#     new_left_top = a_top_left[0] + int(W / 4), c_right_bottom[1] + int(H * 0.3)
#     new_right_bottom = new_left_top[0] + int(2.3 * W), new_left_top[1] + H*4
#
#     return new_left_top, new_right_bottom

def findLineRect(a_left_top, a_right_bottom, b_left_top, b_right_bottom):
    W = a_right_bottom[0] - a_left_top[0]

    new_left_top = max(0, a_left_top[0] - int(W * 0.6)), a_right_bottom[1] + int(W * 1.15)
    new_right_bottom = b_right_bottom[0] + int(W * 1.45), a_left_top[1] + int(W * 2.25)

    return new_left_top, new_right_bottom


# find (top-left, right-bottom) rectangle, by templateFilePath
# img should be grey mode (black)
def findTemplateRect(image, templateFilePath, tem_width=4032.0):
    imgW, imgH = image.shape[::-1]
    method = cv2.TM_CCOEFF

    templateImage = cv2.imread(templateFilePath, 0)
    w, h = templateImage.shape[::-1]

    # resize
    k = imgW / tem_width
    w = int(w * k)
    h = int(h * k)
    templateImage = cv2.resize(templateImage, (w, h))

    res = cv2.matchTemplate(image, templateImage, method)
    min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)

    left_top = max_loc

    # If the method is TM_SQDIFF or TM_SQDIFF_NORMED, take minimum
    #     if method in [cv2.TM_SQDIFF, cv2.TM_SQDIFF_NORMED]:
    #         top_left = min_loc
    #     else:
    #         top_left = max_loc

    bottom_right = (left_top[0] + w, left_top[1] + h)

    return left_top, bottom_right


# draw roi (config in yaml) in img, it will directly draw on img.
def drawRoi(img, roiConfig, color=(0, 0, 0)):
    pt1 = roiConfig['x'], roiConfig['y']
    pt2 = roiConfig['x'] + roiConfig['w'], roiConfig['y'] + roiConfig['h']

    cv2.rectangle(img, pt1, pt2, color, 1)


def createRoi2(img, roi_name, roiConfig, job_id):
    roi = img[roiConfig['y']:roiConfig['y'] + roiConfig['h'], roiConfig['x']:roiConfig['x'] + roiConfig['w']]

    writeImageJob(roi, job_id, 'roi-%s-origin' % roi_name)

    roi_style = roiConfig.get('style', DEFAULT_ROI_STYLE)
    roi = extractText2BlackImage(roi, roi_style, job_id, roi_name)
    path = writeImageJob(roi, job_id, 'roi-%s' % roi_name)
    return roi, path


def loadJobData(job_id):
    dirName = TMP_DIR + '/' + job_id
    fileName = dirName + '/data.yaml'

    f = open(fileName, encoding='utf-8')
    data = yaml.safe_load(f)
    f.close()

    return data


def saveJobData(data, job_id):
    dirName = TMP_DIR + '/' + job_id
    fileName = dirName + '/data.yaml'

    if not os.path.exists(dirName):
        os.makedirs(dirName)

    f = open(fileName, mode='w', encoding='utf-8')

    yaml.safe_dump(data, f, default_flow_style=False, encoding='utf-8')

    f.close()
