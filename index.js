'use strict';

var Metalsmith = require('metalsmith');
var s3util     = require('./lib/s3util');
var each       = require('async').each;
var front      = require('front-matter');
var utf8       = require('is-utf8');

var markdown    = require('metalsmith-markdown');
var templates   = require('metalsmith-templates');
var collections = require('metalsmith-collections');
var draft       = require('metalsmith-drafts');


/**
 * rewriting Metalsmith methods
 */

Metalsmith.prototype.read = function(cb) {
  var files = {};
  var parse = this.frontmatter();
  s3util.readdir(function(err, arr) {
    if(err) return cb(err);
    
    each(arr, read, function(err) {
      cb(err, files);
    });

    function read(readParam, done) {
      s3util.readFile(readParam, function(err, buffer) {
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
  var dest = this.destination();
  each(Object.keys(files), write, cb);

  function write(file, done) {
    var data = files[file];
    return s3util.writeFile(file, data.contents, data.contentType, function (err) {
      if (err) return done(err);
      done();
    });
  }
};

Metalsmith.prototype.build = function (cb) {
  var self = this;
  var clean = this.clean();
  var dest = this.destination();
  if (clean) {
    s3util.rmFiles(function(err, data) {
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
