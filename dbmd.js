var dbox = require('dbox');
var s3 = require('s3');

var DBMDServer = require('./lib/DBMDServer.js');
var DropboxWatcher = require('./lib/DropboxWatcher.js');
var MarkdownCache = require('./lib/MarkdownCache.js');
var MoustacheCache = require('./lib/MoustacheCache.js');
var S3Cache = require('./lib/S3Cache.js');
var URLResolver = require('./lib/URLResolver.js')

var settings = require('./settings.json');

var db_app = dbox.app(settings.dropbox_app_token);
var db_client = db_app.createClient(settings.dropbox_access_token);
var dropbox_watcher = new DropboxWatcher(db_client, 300000); // 5 minute ping

var s3_client = s3.createClient(settings.s3_token);
var s3_cache = new S3Cache(s3_client, dropbox_watcher);

var url_resolver = new URLResolver(s3_cache, dropbox_watcher);

var markdown_cache = new MarkdownCache(dropbox_watcher, url_resolver);
var moustache_cache = new MoustacheCache(dropbox_watcher, url_resolver);

var server = new DBMDServer(
  dropbox_watcher,
  markdown_cache,
  moustache_cache,
  settings
);

var port = process.argv[2];
server.listen(port);
dropbox_watcher.updateNow();
