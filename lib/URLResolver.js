var url = require('url');

function URLResolver(s3_cache, dropbox_watcher) {
  this.s3Cache = s3_cache;
  this.dropboxWatcher = dropbox_watcher;
}

module.exports = URLResolver;

URLResolver.prototype.resolve = function(from, to, skip_s3) {
  from = from.replace(' ', '+');
  to = to.replace(' ', '+');

  // urls with hosts pass through
  if (url.parse(to, false, true).host) {
    return to;
  }

  var resolved = url.resolve(from, to);
  var resolved_unescaped = resolved.replace('+', ' ');
  if (skip_s3) {
    return resolved_unescaped;
  }

  if (this.dropboxWatcher.fileExists(resolved_unescaped)) {
    return this.s3Cache.url(resolved);
  }

  // don't modify further then
  return resolved;
}
