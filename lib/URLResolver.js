var url = require('url');

function URLResolver(s3_client, dropbox_watcher) {
  this.s3Client = s3_client;
  this.dropboxWatcher = dropbox_watcher;
}

module.exports = URLResolver;

var template_rx = /^{{.+?}}$/;

URLResolver.prototype.resolve = function(from, to, skip_s3) {
  from = from.replace(' ', '+');
  to = to.replace(' ', '+');

  // template variables pass through
  if (template_rx.test(to)) {
    return to;
  }

  // urls with hosts pass through
  if (url.parse(to, false, true).host) {
    return to;
  }

  var resolved = url.resolve(from, to);
  if (!skip_s3) {
    var resolved_unescaped = resolved.replace('+', ' ');
    if (this.dropboxWatcher.fileExists(resolved_unescaped)) {
      return this.s3Client.url(resolved);
    }
  }

  // don't modify further then
  return resolved;
}
