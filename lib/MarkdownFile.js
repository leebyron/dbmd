var memoize = require('./memoize.js');

function MarkdownFile(filepath, metadata, html) {
  this.filepath = filepath;
  this.metadata = metadata;
  this.html = html;
}

module.exports = MarkdownFile;

MarkdownFile.prototype.isDraft = memoize.method(function() {
  return /^\/drafts\//.test(this.filepath);
});

MarkdownFile.prototype.getPrimaryPermalink = function() {
  return this.getPermalinks()[0];
};

MarkdownFile.prototype.getPermalinks = memoize.method(function() {
  var permalinks = this.metadata.permalink ?
    this.metadata.permalink.split(' ') : [];
  var title_permalink = this._permalinkForTitle();
  title_permalink && permalinks.push(title_permalink);
  return permalinks;
});

MarkdownFile.prototype.getTitle = function() {
  return this.metadata.title;
};

MarkdownFile.prototype.getTime = memoize.method(function() {
  var date_string = this.metadata.date;
  if (!date_string) {
    return null;
  }

  var time = Date.parse(date_string);
  return isNaN(time) ? null : time;
});

MarkdownFile.prototype.isStandalone = function() {
  return !!this.metadata.standalone;
};

MarkdownFile.prototype.getHTML = function() {
  return this.html;
};

var hr_rx = /<hr\s?\/?>/;

MarkdownFile.prototype.getSnippet = memoize.method(function() {
  var result = hr_rx.match(this.html);
  if (result) {
    return this.snippet = this.html.substr(result.index + result[0].length);
  }
  // TODO: truncate!
  return this.html;
});

MarkdownFile.prototype._permalinkForTitle = function() {
  var title = this.metadata.title;
  if (!title) {
    return null;
  }
  return title.toLowerCase()
    .replace(/[^a-z0-9]/g, '-') // alpha numeric and -
    .replace(/-{2,}/g, '-') // collapse ---
    .replace(/(^-+)|(-+$)/g, ''); // trim -
};
