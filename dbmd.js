var http = require('http');
var url = require('url');
var util = require('util');

var dbox = require('dbox');
var s3 = require('s3');
var mu = require('mu2');

var DropboxWatcher = require('./lib/DropboxWatcher.js');
var MarkdownCache = require('./lib/MarkdownCache.js');
var MoustacheCache = require('./lib/MoustacheCache.js');
var S3Cache = require('./lib/S3Cache.js');
var URLResolver = require('./lib/URLResolver.js')
var og = require('./lib/og.js');
var DateFormatter = require('./lib/DateFormatter.js');

var settings = require('./settings.json');

// get port to open, defaulting to http
var port = process.argv[2] || 80;

var db_app = dbox.app(settings.dropbox_app_token);
var db_client = db_app.createClient(settings.dropbox_access_token);
var dropbox_watcher = new DropboxWatcher(db_client, 300000); // 5 minute ping
var s3_client = s3.createClient(settings.s3_token);
var s3_cache = new S3Cache(s3_client, dropbox_watcher);

var url_resolver = new URLResolver(s3_client, dropbox_watcher);

var markdown_cache = new MarkdownCache(s3_client, dropbox_watcher, url_resolver);
var moustache_cache = new MoustacheCache(s3_client, dropbox_watcher, url_resolver);

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

    var article_map = markdowns.map(function(markdown_file) {
      return '<a href="/'+markdown_file.getPrimaryPermalink()+'">'+
        markdown_file.getTitle()+
      '</a>';
    }).join('<br>');

    var index_data = {
      title: 'Lee Byron',
      og_tags: og.expand(settings.index_og_tags),
      header: 'Hello, I\'m <a href="/me">Lee Byron</a> and I make things.',
      footer: 'Powered by Dropbox, EC2, S3 and node.js and markdown. Set in Elena. Rewrite this.',
    };

    index_data['articles'] = markdowns.map(function(markdown_file) {
      return {
        title: markdown_file.getTitle(),
        time: DateFormatter.format(markdown_file.getTime()),
        permalink: '/' + markdown_file.getPrimaryPermalink(),
        synopsis: markdown_file.getSynopsis(),
        contents: markdown_file.getContents()
      }
    });

    var template_stream = moustache_cache.renderToStream(
      '/static/page.mustache',
      index_data
    );

    if (!template_stream) {
      response.end('Missing template.');
    } else {
      util.pump(template_stream, response);
    }

  } else if (markdown_cache.hasPermalink(permalink)) {
    var markdown_file = markdown_cache.getMarkdownForPermalink(permalink);

    // Rudimentary protection for drafts.
    if (markdown_file.isDraft() && !isAuthenticated(request, response)) {
      return;
    }

    response.writeHead(200, {'Content-Type': 'text/html'});

    var title = markdown_file.getTitle();
    var permalink = markdown_file.getPrimaryPermalink();
    var page_title = title || permalink;
    var iso_date = new Date(markdown_file.getTime()).toISOString();

    // TODO: abstract away direct references to myself or my site
    var og_tags = {
      title: page_title,
      url: "http://leebyron.com/" + permalink,
      site_name: "Lee Byron",
      type: "article",
      article: {
        published_time: iso_date,
        author: "http://leebyron.com/",
        tag: markdown_file.getTags()
      }
    };

    var data = {
      title: page_title + ' by Lee Byron',
      og_tags: og.expand(og_tags),
      canonical_url: '/' + markdown_file.getPrimaryPermalink(),
      custom_css: markdown_file.getCustomCSS(),
      header: title,
      time: DateFormatter.format(markdown_file.getTime()),
      footer: 'Powered by Dropbox, EC2, S3 and node.js and markdown. Set in Elena. Rewrite this.',
      contents: markdown_file.getContents(),
      is_raw: markdown_file.isRaw()
    };

    var template_stream = moustache_cache.renderToStream(
      '/static/page.mustache',
      data
    );

    if (!template_stream) {
      response.end('Missing template.');
    } else {
      util.pump(template_stream, response);
    }


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
