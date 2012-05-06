var DateFormatter = require('./DateFormatter.js');
var memoize = require('./memoize.js');
var og = require('./og.js');

function MarkdownFile(cache, filepath, metadata, contents) {
  this.cache = cache;
  this.filepath = filepath;
  this.metadata = metadata;
  this.contents = contents;
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
  var title_permalink = permalinkForTitle(this.getTitle());
  title_permalink && permalinks.push(title_permalink);
  var time_permalink = permalinkForTime(this.getTime());
  time_permalink && permalinks.push(time_permalink);
  return permalinks;
});

MarkdownFile.prototype.getTitle = function() {
  return this.metadata.title;
};

MarkdownFile.prototype.getAuthor = function() {
  return this.metadata.author;
}

MarkdownFile.prototype.getPageName = memoize.method(function() {
  var title = this.getTitle();
  if (title) {
    return title;
  }
  var permalink = this.getPrimaryPermalink();
  permalink = permalink.split('/')[0].replace(/-/g, ' ').trim();
  return permalink.substr(0, 1).toUpperCase() + permalink.substr(1);
});

MarkdownFile.prototype.getTags = memoize.method(function() {
  var tags_str = this.metadata.tags;
  if (!tags_str) {
    return [];
  }
  return tags_str.split(',').map(function (tag) {
    return tag.trim();
  });
});

MarkdownFile.prototype.getTime = memoize.method(function() {
  var date_string = this.metadata.date;
  if (!date_string) {
    return null;
  }

  var m;
  if (/[ap]m$/.test(date_string)) {
    m = date_string.substr(-2);
    date_string = date_string.substr(0, date_string.length-2);
  }

  var time = Date.parse(date_string);
  if (isNaN(time)) {
    return null;
  }
  if (m === 'pm') {
    time += 43200000; // 12 hours
  }
  return time;
});

MarkdownFile.prototype.getFormattedDate = memoize.method(function() {
  var time = this.getTime();
  if (!time) {
    return null;
  }
  return DateFormatter.format(time);
});

MarkdownFile.prototype.isRaw = function() {
  return !!this.metadata.raw;
};

MarkdownFile.prototype.getContents = function() {
  return this.contents;
};

var hr_rx = /<hr\s?\/?>/;

MarkdownFile.prototype.getSynopsis = memoize.method(function() {
  if (this.metadata.synopsis) {
    var synopsis_filepath = this.cache.urlResolver.resolve(
      this.filepath,
      this.metadata.synopsis,
      true /* skip s3 */
    );
    var synopsis_file = this.cache.getMarkdownForFile(synopsis_filepath);
    if (!synopsis_file) {
      return 'Missing synopsis file: ' + synopsis_filepath;
    } else {
      return synopsis_file.getContents();
    }
  }

  var result = hr_rx.exec(this.contents);
  if (result) {
    return this.snippet = this.contents.substr(0, result.index);
  }

  return null;
});

MarkdownFile.prototype.getCustomCSS = function() {
  if (!this.metadata.css) {
    return null;
  }
  return this.cache.urlResolver.resolve(this.filepath, this.metadata.css);
}

MarkdownFile.prototype.getCustomTemplate = function() {
  if (!this.metadata.template) {
    return null;
  }
  return this.cache.urlResolver.resolve(
    this.filepath,
    this.metadata.template,
    true /* skip s3 */
  );
}

MarkdownFile.prototype.getOpenGraphTags = function() {
  // TODO: abstract away direct references to myself or my site
  return og.expand({
    title: this.getPageName(),
    url: "http://leebyron.com/" + this.getPrimaryPermalink(),
    site_name: "Lee Byron",
    type: "article",
    article: {
      published_time: new Date(this.getTime()).toISOString(),
      author: "http://leebyron.com/",
      tag: this.getTags()
    }
  });
}

function permalinkForTitle(title) {
  if (!title) {
    return null;
  }
  return title.toLowerCase()
    .replace(/[^a-z0-9]/g, '-') // alpha numeric and -
    .replace(/-{2,}/g, '-') // collapse ---
    .replace(/(^-+)|(-+$)/g, ''); // trim -
};

function permalinkForTime(time) {
  if (!time) {
    return null;
  }

  var date = new Date(time);
  var date_str = '' +
    (date.getYear() + 1900) + '/' +
    (date.getMonth() + 1) + '/' +
    date.getDate();
  var time_str = DateFormatter.formatTime(time);
  if (time_str) {
    date_str += '/' + time_str;
  }
  return date_str;
};
