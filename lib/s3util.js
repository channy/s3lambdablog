'use strict';

var AWS = require('aws-sdk');
var config = require('../config.json');

AWS.config.region = config.region;

var writeBucket = new AWS.S3({params: {Bucket: config.destinationBucket}});
var readBucket = new AWS.S3({params: {Bucket: config.sourceBucket}});

function readdir(cb) {
  readBucket.listObjects(function(err, data) {
    if (err) return cb(err);
    var fileArray = data.Contents.map(function(o) {
      return {Key: o.Key};
    });
    if (fileArray.length === 0) {
      return cb();
    }
    cb(null, fileArray);
  });
}

function readFile(readParam, cb) {
  readBucket.getObject(readParam, function(err, data) {
    if (err) return cb(err);
    cb(null, data.Body);
  });
}

function rmFiles (cb) {
  writeBucket.listObjects(function(err, data) {
    if (err) {
      cb(err);
      return;
    }
    var fileArray = data.Contents.map(function(o) {
      return {Key: o.Key};
    });
    if (fileArray.length === 0) {
      cb();
      return;
    }
    var deleteParam = {Delete: {Objects: fileArray}};
    writeBucket.deleteObjects(deleteParam, function (err, data) {
      if (err) {
        cb(err);
      } else {
        cb(null, data);
      }
    });
  });
}

function writeFile (key, value, contentType, cb) {
  if (!value) return cb();
  var writeParam = {Key: key, Body: value};
  if (contentType) writeParam.ContentType = contentType;
  writeBucket.upload(writeParam, function(err, data) {
    if (err) {
      return cb(err);
    }
    cb(null, data);
  });
}

exports.rmFiles = rmFiles;
exports.writeFile = writeFile;
exports.readdir = readdir;
exports.readFile = readFile;
