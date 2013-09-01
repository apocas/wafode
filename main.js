var http = require('http');

setInterval(function() {
  console.log('Hello world!');
}, 5000);

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World\n');
}).listen(80);