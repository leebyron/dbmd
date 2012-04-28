var readline = require('readline');
var dbox = require('dbox');

var settings = require('./settings.json');

var rl = readline.createInterface(process.stdin, process.stdout, null);
var db_app = dbox.app(settings.dropbox_app_token);

db_app.request_token(function(status, request_token) {
  console.log(request_token);
  rl.question(request_token.authorize_url, function (answer) {
    db_app.access_token(request_token, function(status, access_token) {
      console.log(access_token);
      rl.close();
      process.stdin.destroy();
    });
  });
});
