var async = require('async');
var util = require('util');
var EventEmitter = require('events').EventEmitter;


function DropboxWatcher(db_client, update_frequency) {
  this.client = db_client;
  this.polling = false;
  this.metadata = {};
  this.shouldDownloadFunctions = [];
  this.cursor = null;
  this.on('poll', function () {
    setTimeout(function() {
      if (!this.polling) {
        this._pollDelta();
      }
    }.bind(this), update_frequency);
  });
}

module.exports = DropboxWatcher;

util.inherits(DropboxWatcher, EventEmitter);

DropboxWatcher.prototype.updateNow = function(callback) {
  callback && this.once('poll', callback);
  !this.polling && this._pollDelta();
};

DropboxWatcher.prototype.fileExists = function(filepath) {
  return !!this.metadata[filepath];
};

DropboxWatcher.prototype.getMetadata = function(filepath) {
  return this.metadata[filepath];
};

DropboxWatcher.prototype._pollDelta = function() {
  if (this.polling) {
    throw new Error('Called _pollDelta during existing poll');
  }

  this.polling = true;

  this.client.delta({cursor: this.cursor}, function(status, response) {
    if (response.error) {
      console.error(response.error);
      // TODO: should do something better?
      this.emit('poll');
      return;
    }

    if (response.reset) {
      this.metadata = {};
      this.fileBytes = {};
      this.emit('reset');
    }

    this.cursor = response.cursor;

    var tasks = [];
    response.entries.forEach(function(entry) {
      var filepath = entry[0];
      var metadata = entry[1];

      if (!metadata && this.metadata[filepath]) {
        var old_metadata = this.metadata[filepath];
        delete this.metadata[filepath];
        this.emit('delete', filepath, old_metadata);
      } else if (metadata && !metadata.is_dir) {
        tasks.push(function(callback) {
          this.shouldDownloadFile(filepath, metadata, function(do_download) {
            if (do_download) {
              this.client.get(filepath, function(status, bytes) {
                // TODO: deal with bad status.
                this.metadata[filepath] = metadata;
                this.emit('update', filepath, metadata, bytes);
                callback();
              }.bind(this));
            } else {
              this.metadata[filepath] = metadata;
              this.emit('update', filepath, metadata);
              callback();
            }
          }.bind(this));
        }.bind(this));
      }
    }.bind(this));

    async.parallel(tasks, function() {
      this.polling = false;
      if (response.has_more) {
        this._pollDelta();
      } else {
        this.emit('poll');
      }
    }.bind(this));
  }.bind(this));
};

DropboxWatcher.prototype.addShouldDownloadFileFn = function(fn) {
  this.shouldDownloadFunctions.push(fn);
};

DropboxWatcher.prototype.shouldDownloadFile = function(filepath, metadata, callback) {
  if (this.shouldDownloadFunctions.length === 0) {
    callback(false);
  }

  var tasks = [];
  for (var ii = 0; ii < this.shouldDownloadFunctions.length; ++ii) {
    tasks.push(
      async.apply(this.shouldDownloadFunctions[ii], filepath, metadata)
    );
  }

  async.parallel(tasks, function (error, results) {
    for (var ii = 0; ii < results.length; ++ii) {
      if (results[ii]) {
        return callback(true);
      }
    }
    return callback(false);
  });
};
