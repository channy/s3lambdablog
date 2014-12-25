'use strict';

var Metalsmith = require('metalsmith');
var fakeS3     = require('./lib/fakeS3');
var each       = require('async').each;
var front      = require('front-matter');
var utf8       = require('is-utf8');

var markdown    = require('metalsmith-markdown');
var templates   = require('metalsmith-templates');
var collections = require('metalsmith-collections');
var draft       = require('metalsmith-drafts');

var config = require('./config.json');
var destBucket = new fakeS3({
  region: config.region,
  params: {Bucket: config.destinationBucket}
});
var sourceBucket = new fakeS3({
  region: config.region,
  params: {Bucket: config.sourceBucket}
});


/**
 * rewriting Metalsmith methods
 */

Metalsmith.prototype.read = function(cb) {
  var files = {};
  var parse = this.frontmatter();
  sourceBucket.readdir(function(err, arr) {
    if(err) return cb(err);
    
    each(arr, read, function(err) {
      cb(err, files);
    });

    function read(readParam, done) {
      sourceBucket.readFile(readParam, function(err, buffer) {
        if (err) return done(err);
        var file = {};

        if (parse && utf8(buffer)) {
          var parsed = front(buffer.toString());
          file = parsed.attributes;
          file.contents = new Buffer(parsed.body);
          file.contentType = 'text/html';
        } else {
          file.contents = buffer;
        }
        files[readParam.Key] = file;
        done();
      });
    };
  });
};

Metalsmith.prototype.write = function(files, cb) {
  each(Object.keys(files), write, cb);

  function write(file, done) {
    var data = files[file];
    return destBucket.writeFile(file, data.contents, data.contentType, function (err) {
      if (err) return done(err);
      done();
    });
  }
};

Metalsmith.prototype.build = function (cb) {
  var self = this;
  var clean = this.clean();
  if (clean) {
    destBucket.removeFiles(function(err, data) {
      if (err) return cb(err);
      self.read(function(err, files) {
        if (err) return cb(err);
        self.run(files, function(err, files) {
          if (err) return cb(err);
          self.write(files, function(err) {
            cb(err, files);
          });
        });
      });
    });
  }
};


/**
 * invoke metalsmith with lambda
 */
exports.handler = function(event, context) {
  var metalsmith = new Metalsmith(__dirname);
  metalsmith
    .use(draft())
    .use(collections({
      articles: {
        pattern: '*.md',
        sortBy: 'date',
        reverse: true
      }
    }))
    .use(markdown())
    .use(templates('handlebars'))
    .build(function (err, files) {
        console.log(files);
        context.done(err);
    });
}
