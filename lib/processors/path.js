var natural = require('natural');
var Toolbox = require('../toolbox');

var Path = function () {
  this.tokenizer = new natural.RegexpTokenizer({ pattern: /\// });


  this.keywords = ['select%', 'show', 'top', 'distinct', 'from', 'dual', 'group by', 'order by', 'having', 'limit', 'offset', 'union%', 'union all', 'rownum as', 'alter', 'merge', 'concat%', 'char(']
  this.badKeywords = ['.git', '.secret', '.DS_Store', '.pgpass', 'wp-config.php']
};

Path.prototype.process = function (req, callback) {
  if (req.processors.path !== undefined) {
    if (callback) return callback(null, { 'path': req.processors.path })
  }

  var output = {};

  if (req.path) {
    var q = req.path.split('?');
    var tokens = this.tokenizer.tokenize(q[0]);

    if (q.length > 1) {
      output.querystringparams = q[1].split('&').length;
      output.querystringlength = q[1].length;
      output.injectionkeywords = Toolbox.countMatches(q[1].toLowerCase(), this.keywords);
      output.badkeywords = Toolbox.countMatches(q[1].toLowerCase(), this.badKeywords);
    } else {
      output.querystringparams = 0;
      output.querystringlength = 0;
      output.injectionkeywords = 0;
    }

    output.pathlength = req.path.length;
    output.tokens = tokens.length;

    var specialChars = /[!@#$%^*()+\-=\[\]{};':"\\|<>]/gi;
    var chars = req.path.match(specialChars);
    if (chars !== null) {
      output.specialchars = chars.length;
    } else {
      output.specialchars = 0;
    }

    if (output.querystringparams > 0) {
      output.specialcharsprop = output.specialchars / output.querystringparams;
    } else {
      output.specialcharsprop = 0;
    }

    if (tokens.length > 0) {
      var lastToken = tokens[tokens.length - 1];
      if (lastToken.indexOf('.') >= 0 && lastToken.indexOf('.php') < 0) {
        output.isdynamic = 0;
      } else {
        output.isdynamic = 1;
      }
    } else {
      output.isdynamic = 1;
    }
  } else {
    //console.log("PATH PROCESSOR FAIL");
    //console.log(req);
  }

  req.processors.path = output;

  if (callback) callback(null, { 'path': output });
}

module.exports = Path;