var http = require('http');
var url = require('url');
var og = require('./og.js');


function DBMDServer(dropbox_watcher, markdown_cache, moustache_cache, settings) {
  this.dropboxWatcher = dropbox_watcher;
  this.markdownCache = markdown_cache;
  this.moustacheCache = moustache_cache;
  this.settings = settings;
}

module.exports = DBMDServer;

DBMDServer.prototype.listen = function(port) {
  // defaults to http
  port = port || 80;
  http.createServer(this._handleConnection.bind(this)).listen(port);
};

DBMDServer.prototype._handleConnection = function(request, response) {
  request.url = url.parse(request.url, true /* parse query */);
  new DBMDRequest(this, request, response).handle();
};

function DBMDRequest(server, request, response) {
  this.server = server;
  this.request = request;
  this.response = response;
}

DBMDRequest.prototype.handle = function() {
  if (this.request.url.query.force) {
    if (this.isAuthenticated()) {
      this.server.dropboxWatcher.updateNow(this.generateResponse.bind(this));
    }
  } else {
    this.generateResponse();
  }
};

DBMDRequest.prototype.generateResponse = function() {
  var permalink = this.request.url.pathname.substr(1);
  var markdownCache = this.server.markdownCache;

  if (!permalink) { // Index page
    var showall = !!this.request.url.query.showall;
    if (showall && !this.isAuthenticated()) {
      return;
    }

    var markdowns = showall ?
      markdownCache.getAllMarkdownsByTime() :
      markdownCache.getPublishedMarkdownsByTime();

    this.renderTemplate(
      this.server.settings.index_template,
      {
        og_tags: og.expand(this.server.settings.index_og_tags),
        pages: markdowns
      }
    );
  } else if (markdownCache.hasPermalink(permalink)) {
    var markdown_file = markdownCache.getMarkdownForPermalink(permalink);

    // Rudimentary protection for drafts.
    if (markdown_file.isDraft() && !this.isAuthenticated()) {
      return;
    }

    this.renderTemplate(
      markdown_file.getCustomTemplate() || this.server.settings.page_template,
      markdown_file
    );
  } else {
    this.response.writeHead(404, {'Content-Type': 'text/html'});
    this.response.end('404');
  }
};

DBMDRequest.prototype.renderTemplate = function(template, data) {
  this.response.writeHead(200, {'Content-Type': 'text/html'});
  var stream = this.server.moustacheCache.renderToStream(template, data);
  stream.pipe(this.response);
};

DBMDRequest.prototype.isAuthenticated = function() {
  var token = (this.request.headers.authorization || '').split(/\s+/).pop();
  var auth = new Buffer(token, 'base64').toString().split(/:/);
  var username = auth[0];
  var password = auth[1];
  var credentials = this.server.settings.draft_credentials;

  if (username !== credentials.username || password !== credentials.password) {
    this.response.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="Draft Document"'
    });
    this.response.end('401');
    return false;
  }
  return true;
};
