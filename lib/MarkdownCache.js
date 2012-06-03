var querystring = require('querystring');
var url = require('url');

var highlight = require('highlight');
var ShowdownParser = require('showdown').ShowdownParser;
var MarkdownFile = require('./MarkdownFile.js');
var SortedList = require('./SortedList.js');

// Ensure highlight knows about languages we might use
highlight.init(Function.prototype, ['xml', 'php', 'css', 'javascript', 'nginx', 'cpp', 'objectivec']);

var markdown_rx = /\.(md|markdn|mdown|markdown|text)$/;

function MarkdownCache(dropbox_watcher, url_resolver) {
  this.dropboxWatcher = dropbox_watcher;
  this.urlResolver = url_resolver;
  this._reset();

  dropbox_watcher.addShouldDownloadFileFn(function (filepath, metadata, callback) {
    var is_markdown = markdown_rx.test(filepath);
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

MarkdownCache.prototype.getMarkdownForFile = function(filepath) {
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
  if (!file_bytes || !markdown_rx.test(filepath)) {
    return;
  }

  var parser = new ShowdownParser(file_bytes.toString());
  parser.setURLTransform(function (url_str) {
    return this.urlResolver.resolve(filepath, url_str);
  }.bind(this));
  parser.setCodeTransform(function (code_str) {
    return highlight.highlight(code_str);
  });

  var markdown_file = new MarkdownFile(
    this,
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

MarkdownCache.prototype._deleteFilepath = function(filepath) {
  this.markdownFiles[filepath] &&
    this._removeMarkdownFile(this.markdownFiles[filepath]);
};

MarkdownCache.prototype._removeMarkdownFile = function(markdown_file) {
  delete this.markdownFiles[markdown_file.filepath];
  this.allTimeSorted.remove(markdown_file);
  this.publishedTimeSorted.remove(markdown_file);
};
