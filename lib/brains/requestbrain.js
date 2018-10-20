var synaptic = require('synaptic');

var Brain = require('../brain');

var UserAgentProc = require('../processors/useragent');
var AddressProc = require('../processors/address');
var PathProc = require('../processors/path');

class RequestBrain extends Brain {
  constructor(performance) {
    super();

    this.maxFloatingInputs = [0, 0, 0, 0, 0];

    this.network = new synaptic.Architect.Perceptron(6, 10, 1);

    this.name = this.constructor.name;
    this.performance = performance || super.performance;
  }

  initializeProcessors() {
    this.processors.push(new UserAgentProc());
    this.processors.push(new AddressProc());
    this.processors.push(new PathProc());
    this.print('Processors initialized...');
  }

  buildInputs(results) {
    return [
      [
        results.path.querystringparams,
        results.path.pathlength,
        results.path.specialcharsprop,
        results.path.injectionkeywords,
        results.path.badkeywords
      ],
      [
        results.path.isdynamic
      ]
    ];
  }

  preProcessing(req, results, callback) {
    callback();
  }

  postProcessing(req) {
    this.localRedis.incr(req.ip + '_bad_reqs');
    this.localRedis.expire(req.ip + '_bad_reqs', 6 * 3600);
  }

  printMaxs() {
    this.print('Maximum QS parameters: ' + this.maxFloatingInputs[0]);
    this.print('Maximum path length: ' + this.maxFloatingInputs[1]);
    this.print('Maximum special chars porportion: ' + this.maxFloatingInputs[2]);
    this.print('Maximum injection keywords: ' + this.maxFloatingInputs[3]);
  }

  isSuspicious(results) {
    return results.path.badkeywords > 0 || (results.path.isdynamic === 1 &&
      results.path.querystringparams > 0 &&
      (results.path.injectionkeywords > 3 && (results.path.querystringparams < 10 || results.path.querystringparams > 50)) &&
      results.path.specialcharsprop > 20);
  }
}


module.exports = RequestBrain;