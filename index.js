var compression = require('compression');
var express = require('express');
const morgan = require('morgan');
var http = require('http')
var https = require('https')
var app = express()
const os = require('os');
const jwt = require('jsonwebtoken');
var concat = require('concat-stream');

app.set('json spaces', 2);
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

// this writes the apache logs to stdout
app.use(morgan('combined'));
// this is for gzip compression
app.use(compression());

// don't log any json for these hosts
const drop_list = [
  "ido-ble-lib.cn-hongkong.log.aliyuncs.com",
];

app.use(function(req, res, next){
  req.pipe(concat(function(data){
    req.body = data.toString('utf8');
    next();
  }));
});

const myRef = "http-https-echo.homelan.local";

app.all('*', (req, res) => {
  const echo = {
    reference: myRef,
    path: req.path,
    headers: req.headers,
    method: req.method,
    body: req.body,
    cookies: req.cookies,
    fresh: req.fresh,
    hostname: req.hostname,
    ip: req.ip,
    ips: req.ips,
    protocol: req.protocol,
    query: req.query,
    subdomains: req.subdomains,
    xhr: req.xhr,
    os: {
      hostname: os.hostname()
    },
    connection: {
      servername: req.connection.servername
    }
  };

  if(req.is('application/json')){
    try {
      echo.json = JSON.parse(req.body);
    }
    catch (e) {
      //echo.req_body = req.body;
      //pass
    }
  }

  if (process.env.JWT_HEADER) {
    let token = req.headers[process.env.JWT_HEADER.toLowerCase()];
    if (!token) {
      echo.jwt = token;
    } else {
      token = token.split(" ").pop();
      const decoded = jwt.decode(token, {complete: true});
      echo.jwt = decoded;
    }
  }

  // send back to client
  res.json(echo);

  
  //if (process.env.LOG_IGNORE_PATH != req.path) {
    //console.log('-----------------')
    //console.log(JSON.stringify(echo, null, 4));

    // log to stdout and thus elasticsearch
    if (! echo.headers.host in drop_list) { // don't log if in droplist
      console.log(JSON.stringify(echo, null)); // one-liner for elasticsearch
    };
  //}
});

const sslOpts = {
  key: require('fs').readFileSync('privkey.pem'),
  cert: require('fs').readFileSync('fullchain.pem'),
};

var httpServer = http.createServer(app).listen(process.env.HTTP_PORT || 80);
var httpsServer = https.createServer(sslOpts,app).listen(process.env.HTTPS_PORT || 443);

let calledClose = false;

process.on('exit', function () {
  if (calledClose) return;
  console.log('Got exit event. Trying to stop Express server.');
  server.close(function() {
    console.log("Express server closed");
  });
});

process.on('SIGINT', shutDown);
process.on('SIGTERM', shutDown);

function shutDown(){
  console.log('Got a kill signal. Trying to exit gracefully.');
  calledClose = true;
  httpServer.close(function() {
    httpsServer.close(function() {
      console.log("HTTP and HTTPS servers closed. Asking process to exit.");
      process.exit()
    });
    
  });
}
