var querystring = require('querystring');
var url = require('url');
var ShowdownParser = require('showdown').ShowdownParser;
var MarkdownFile = require('./MarkdownFile.js');
var SortedList = require('./SortedList.js');

function MarkdownCache(s3_client, dropbox_watcher) {
  this.s3Client = s3_client;
  this.dropboxWatcher = dropbox_watcher;
  this._reset();

  dropbox_watcher.addShouldDownloadFileFn(function (filepath, metadata, callback) {
    var is_markdown = /\.md$/.test(filepath);
    callback(null, is_markdown);
  });

  dropbox_watcher.on('reset', this._reset.bind(this));
  dropbox_watcher.on('update', this._updateFilepath.bind(this));
  dropbox_watcher.on('delete', this._deleteFilepath.bind(this));
}

module.exports = MarkdownCache;

MarkdownCache.prototype.hasPermalink = function(permalink) {
  return !!this.getMarkdownForPermalink(permalink);
};

MarkdownCache.prototype.getMarkdownForPermalink = function(permalink) {
  var filepath = this.permalinks[permalink];
  return this.markdownFiles[filepath];
};

MarkdownCache.prototype.getAllMarkdownsByTime = function() {
  return this.allTimeSorted.getArray();
};

MarkdownCache.prototype.getPublishedMarkdownsByTime = function() {
  var now = Date.now();
  return this.publishedTimeSorted.getAfter(function (item) {
    return item.getTime() < now;
  });
};

MarkdownCache.prototype._reset = function() {
  this.markdownFiles = {};
  this.permalinks = {};
  this.publishedTimeSorted = new SortedList(compareFiles);
  this.allTimeSorted = new SortedList(compareFiles);
};

function compareFiles(f1, f2) {
  return f1.getTime() > f2.getTime();
}

MarkdownCache.prototype._updateFilepath = function(filepath, metadata, file_bytes) {
  // only listen to changes on markdown files
  if (!file_bytes || !/\.md$/.test(filepath)) {
    return;
  }

  var parser = new ShowdownParser(file_bytes.toString());
  parser.setURLTransform(function (url_str) {
    var resolved = url.resolve(
      filepath.replace(' ', '+'),
      url_str.replace(' ', '+')
    ).replace('+', ' ');
    if (resolved[0] !== '/') {
      return resolved;
    } else if (this.hasPermalink(resolved)) {
      return resolved;
    } else {
      // All unknown urls just get pointed to s3
      return this.s3Client.url(resolved);
    }
  }.bind(this));

  var markdown_file = new MarkdownFile(
    filepath,
    parser.getMetadata(),
    parser.getHTML()
  );

  this._addMarkdownFile(markdown_file);
};

MarkdownCache.prototype._addMarkdownFile = function(markdown_file) {
  var filepath = markdown_file.filepath;

  // remove existing file
  this._deleteFilepath(filepath);

  // add file
  this.markdownFiles[filepath] = markdown_file;

  // update permalinks
  var permalinks = markdown_file.getPermalinks();
  for (var ii = 0; ii < permalinks.length; ++ii) {
    this.permalinks[permalinks[ii]] = filepath;
  }

  // add to dated entries
  if (markdown_file.getTime()) {
    this.allTimeSorted.add(markdown_file);
    if (!markdown_file.isDraft()) {
      this.publishedTimeSorted.add(markdown_file);
    }
  }
};
/*
MarkdownCache.prototype._addMarkdownFileToPublishedTimeList = function(markdown_file) {
  for (var ii = 0; ii < this.publishedTimeSorted.length; ++ii) {
    if (markdown_file.getTime() > this.publishedTimeSorted[ii].getTime()) {
      this.publishedTimeSorted.splice(ii, 0, markdown_file);
      return;
    }
  }
  this.publishedTimeSorted.push(markdown_file);
};

MarkdownCache.prototype._addMarkdownFileToAllTimeList = function(markdown_file) {
  for (var ii = 0; ii < this.allTimeSorted.length; ++ii) {
    if (markdown_file.getTime() > this.allTimeSorted[ii].getTime()) {
      this.allTimeSorted.splice(ii, 0, markdown_file);
      return;
    }
  }
  this.allTimeSorted.push(markdown_file);
};
*/

MarkdownCache.prototype._deleteFilepath = function(filepath) {
  this.markdownFiles[filepath] &&
    this._removeMarkdownFile(this.markdownFiles[filepath]);
};

MarkdownCache.prototype._removeMarkdownFile = function(markdown_file) {
  delete this.markdownFiles[markdown_file.filepath];
  this.allTimeSorted.remove(markdown_file);
  this.publishedTimeSorted.remove(markdown_file);
};
