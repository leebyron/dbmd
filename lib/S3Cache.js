var META_VERSION = 'x-amz-meta-dbox-version';

function S3Cache(s3_client, dropbox_watcher) {
  this.client = s3_client;
  this.dropboxWatcher = dropbox_watcher;
  this.headers = {};

  dropbox_watcher.addShouldDownloadFileFn(function (filepath, metadata, callback) {
    this.headFile(filepath, metadata.rev, function (header) {
      // should download if we haven't already uploaded the same file
      callback(null, !header || header[META_VERSION] != metadata.rev);
    });
  }.bind(this));

  dropbox_watcher.on('update', this._updateFilepath.bind(this));
  dropbox_watcher.on('delete', this._deleteFilepath.bind(this));
}

module.exports = S3Cache;

S3Cache.prototype.url = function(filepath) {
  return this.client.url(filepath);
};

S3Cache.prototype.hasFile = function(filepath) {
  return !!this.headers[filepath];
};

S3Cache.prototype.hasFileAtVersion = function(filepath, version) {
  var header = this.headers[filepath];
  return header && header[META_VERSION] == version;
};

S3Cache.prototype.headFile = function(filepath, version, callback) {
  if (this.hasFileAtVersion(filepath, version)) {
    callback(this.headers[filepath]);
  } else {
    this.client.headFile(filepath, function(response) {
      if (response.statusCode === 200) {
        this.headers[filepath] = response.headers;
        callback(response.headers);
      } else {
        callback({});
      }
    }.bind(this));
  }
};

S3Cache.prototype.putFile = function(data, mimetype, filepath, version) {
  if (this.hasFileAtVersion(filepath, version)) {
    throw new Error('Trying to put a file that already exists in cache.');
  }
  var headers = {
    'Content-Length': data.length,
    // This is a dropbox mirror, so it's okay to take the risk
    'x-amz-storage-class': 'REDUCED_REDUNDANCY'
  };
  headers[META_VERSION] = version;
  var request = this.client.putFile(filepath, headers);
  request.on('response', function (response) {
    // TODO: error case
    this.headers[filepath] = headers;
  }.bind(this));
  request.end(data);
};

S3Cache.prototype.deleteFile = function(filepath, callback) {
  delete this.headers[filepath];
  this.client.deleteFile(filepath, callback);
};

S3Cache.prototype._updateFilepath = function(filepath, metadata, file_bytes) {
  if (file_bytes && !this.hasFileAtVersion(filepath, metadata.rev)) {
    this.putFile(file_bytes, metadata.mime_type, filepath, metadata.rev);
  }
};

S3Cache.prototype._deleteFilepath = function(filepath, metadata) {
  this.deleteFile(filepath);
};
