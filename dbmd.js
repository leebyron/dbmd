var http = require('http');
var url = require('url');
var dbox = require('dbox');
var s3 = require('s3');

var DropboxWatcher = require('./lib/DropboxWatcher.js');
var MarkdownCache = require('./lib/MarkdownCache.js');
var S3Cache = require('./lib/S3Cache.js');

var settings = require('./settings.json');

// get port to open, defaulting to http
var port = process.argv[2] || 80;

var db_app = dbox.app(settings.dropbox_app_token);
var db_client = db_app.createClient(settings.dropbox_access_token);
var dropbox_watcher = new DropboxWatcher(db_client, 300000); // 5 minute ping
var s3_client = s3.createClient(settings.s3_token);
var s3_cache = new S3Cache(s3_client, dropbox_watcher);
var markdown_cache = new MarkdownCache(s3_client, dropbox_watcher);

dropbox_watcher.updateNow();

http.createServer(function (request, response) {
  request.url = url.parse(request.url, true /* parse query */);
  if (request.url.query.force) {
    dropbox_watcher.updateNow(function() {
      handleRequest(request, response);
    });
  } else {
    handleRequest(request, response);
  }
}).listen(port);

function handleRequest(request, response) {

  var permalink = request.url.pathname.substr(1);
  var filepath = unescape(request.url.pathname);

  // Request authentication for any url in /drafts/
  if (/^\/drafts\//.test(filepath) && !isAuthenticated(request, response)) {
    return;
  }

  if (!permalink) {

    var drafts = !!request.url.query.showdrafts;
    if (drafts && !isAuthenticated(request, response)) {
      return;
    }

    var markdowns = drafts ?
      markdown_cache.getAllMarkdownsByTime() :
      markdown_cache.getPublishedMarkdownsByTime();

    response.writeHead(200, {'Content-Type': 'text/html'});
    response.end(
      '<html>'+
      '<head>'+
        '<title>Lee Byron</title>'+
        '<link rel="shortcut icon" href="http://daringfireball.net/favicon.ico" />'+
      '</head>' +
      '<body>' +
      '<h1>Files:</h1>' +
      markdowns.map(function(markdown_file) {
        return '<a href="/'+markdown_file.getPrimaryPermalink()+'">'+
          markdown_file.getTitle()+
        '</a>';
      }).join('<br>') +
      '</body></html>'
    );
  } else if (markdown_cache.hasPermalink(permalink)) {
    var markdown_file = markdown_cache.getMarkdownForPermalink(permalink);

    // Rudimentary protection for drafts.
    if (markdown_file.isDraft() && !isAuthenticated(request, response)) {
      return;
    }

    var title = markdown_file.getTitle() || markdown_file.getPrimaryPermalink();
    if (markdown_file.isDraft()) {
      title = '<draft> ' + title;
    }

    var header = '';
    if (!markdown_file.isStandalone()) {
      header = '<h1>Lee Byron Website</h1>' +
        (markdown_file.getTitle() ?
          '<h1>' + markdown_file.getTitle() + '</h1>' :
          ''
        );
    }

    response.writeHead(200, {'Content-Type': 'text/html'});
    response.end(
      '<html>'+
      '<head>'+
        '<title>'+title+' | Lee Byron</title>'+
        '<link rel="shortcut icon" href="http://daringfireball.net/favicon.ico" />'+
      '</head>' +
      '<body>' +
        header +
        markdown_file.getHTML() +
      '</body></html>'
    );
  } else {
    response.writeHead(404, {'Content-Type': 'text/html'});
    response.end('404');
  }
}

function isAuthenticated(request, response) {
  var token = (request.headers.authorization || '').split(/\s+/).pop(),
      auth = new Buffer(token, 'base64').toString().split(/:/),
      username = auth[0],
      password = auth[1];

  if (username !== settings.draft_credentials.username ||
      password !== settings.draft_credentials.password) {
    response.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="Draft Document"'
    });
    response.end('401');
    return false;
  }
  return true;
}
