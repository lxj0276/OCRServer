#!/usr/bin/env python
# -*- coding: utf-8 -*-
from flask import Flask, jsonify, request
from flask_restful import reqparse, abort, Api, Resource


class CompressImageApi(Resource):
    '''
    input:{
      job_id: 'the id of this job'
    }

    response:
    {
        code: 0,
        message: 'OK',
        data: {
            file: 'the absolute path of compressed image file.'
        }
    }

    '''

    def post(self):
        json_data = request.get_json(force=True)

        dummy_data = {
            file: '/mnt/.../i.jpg'
        }

        return {
            'code': 0,
            'message': 'OK',
            'data': dummy_data
        }
