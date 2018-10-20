var uaParser = require('ua-parser-js');

var UserAgent = function () {

};

UserAgent.prototype.process = function (req, callback) {
  if (req.processors.useragent !== undefined) {
    if (callback) return callback(null, { 'useragent': req.processors.useragent })
  }

  var output = {};
  output.agent = 'unknown';

  if (req.http_user_agent) {
    var agent = uaParser(req.http_user_agent)
    if (agent.browser.name) {
      output.agent = agent.browser.name;
    } else if (agent.ua.toLowerCase().indexOf('bot') >= 0) {
      output.agent = 'bot';
    } else {
      //console.log(agent.ua);
    }
  } else {
    //console.log("USERAGENT PROCESSOR FAIL");
    //console.log(req);
  }

  req.processors.useragent = output;

  if (callback) callback(null, { 'useragent': output });
}

module.exports = UserAgent;