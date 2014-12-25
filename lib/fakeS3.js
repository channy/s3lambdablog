'use strict';

var AWS = require('aws-sdk');

function fakeS3(param) {
  this._bucket = new AWS.S3(param);
}

fakeS3.prototype.readdir = function (cb) {
  this._bucket.listObjects(function(err, data) {
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

fakeS3.prototype.readFile = function (readParam, cb) {
  this._bucket.getObject(readParam, function(err, data) {
    if (err) return cb(err);
    cb(null, data.Body);
  });
};

fakeS3.prototype.removeFiles = function (cb) {
  var self = this;
  this.readdir(function(err, files) {
    if (err) return cb(err);
    if (!files) return cb();
    var deleteParam = {Delete: {Objects: files}};
    self._bucket.deleteObjects(deleteParam, function (err, data) {
      if (err) return cb(err);
      return cb(null, data);
    });
  });
};

fakeS3.prototype.writeFile = function (key, value, contentType, cb) {
  if (!value) return cb();
  var writeParam = {Key: key, Body: value};
  if (contentType) writeParam.ContentType = contentType;
  this._bucket.upload(writeParam, function(err, data) {
    if (err) return cb(err);
    cb(null, data);
  });
};

module.exports = fakeS3;
