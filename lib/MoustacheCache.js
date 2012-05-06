var url = require('url');
var mu = require('mu2');

var moustache_rx = /\.mustache$/;

function MoustacheCache(s3_client, dropbox_watcher, url_resolver) {
  this.s3Client = s3_client;
  this.dropboxWatcher = dropbox_watcher;
  this.urlResolver = url_resolver;
  this._reset();

  dropbox_watcher.addShouldDownloadFileFn(function (filepath, metadata, callback) {
    var is_moustache = moustache_rx.test(filepath);
    callback(null, is_moustache);
  });

  dropbox_watcher.on('reset', this._reset.bind(this));
  dropbox_watcher.on('update', this._updateFilepath.bind(this));
  dropbox_watcher.on('delete', this._deleteFilepath.bind(this));
}

module.exports = MoustacheCache;

MoustacheCache.prototype.hasTemplate = function(filepath) {
  return !!this.templates[filepath];
};

MoustacheCache.prototype.renderToStream = function(filepath, data) {
  if (!this.hasTemplate(filepath)) {
    // TODO: only in dev?
    console.error('Missing template: ' + filepath);
    return null;
  }
  return mu.render(filepath, data);
};

MoustacheCache.prototype._reset = function() {
  this.templates = {};
};

MoustacheCache.prototype._updateFilepath = function(filepath, metadata, file_bytes) {
  // only listen to changes on mustache files
  if (!file_bytes || !moustache_rx.test(filepath)) {
    return;
  }

  var template_str = file_bytes.toString().replace(
    /(href|src)="([^"]+)"/g,
    function (str, param, url_str) {
      url_str = this.urlResolver.resolve(filepath, url_str);
      return param + '="' + url_str + '"';
    }.bind(this)
  );

  mu.compileText(filepath, template_str, function (error, template) {
    if (error) {
      console.error(error);
    } else {
      this.templates[filepath] = true;
    }
  }.bind(this));
};

MoustacheCache.prototype._deleteFilepath = function(filepath) {
  delete this.templates[filepath];
};
