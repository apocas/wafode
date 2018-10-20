var synaptic = require('synaptic');

var Brain = require('../brain');

var UserAgentProc = require('../processors/useragent');
var MetricsProc = require('../processors/metrics');
var AddressProc = require('../processors/address');
var PathProc = require('../processors/path');

class IPBrain extends Brain {
  constructor(performance) {
    super();

    this.maxFloatingInputs = [0, 0];

    this.network = new synaptic.Architect.Perceptron(6, 10, 1);

    this.name = this.constructor.name;
    this.performance = performance || super.performance;
  }

  initializeProcessors() {
    this.processors.push(new UserAgentProc());
    this.processors.push(new MetricsProc());
    this.processors.push(new AddressProc());
    this.processors.push(new PathProc());
    this.print('Processors initialized...');
  }

  buildInputs(results) {
    return [
      [
        results.metrics.hosts,
        results.metrics.reqs
      ],
      [
        (results.useragent.agent === 'bot') ? 1 : 0,
        results.metrics.verbsproportion,
        results.metrics.typeproportion,
        results.address.foreign
      ]
    ];
  }

  preProcessing(req, results, callback) {
    if (results.path.isdynamic === 1) {
      this.localRedis.incr(req.ip + '_dynamic_reqs');
      this.localRedis.expire(req.ip + '_dynamic_reqs', 1800);
    }

    this.localRedis.get(req.ip + '_dynamic_reqs', function (err, dynamicreqs) {
      if (dynamicreqs !== null) {
        results.metrics.dynamicreqs = parseInt(dynamicreqs);
      } else {
        results.metrics.dynamicreqs = 0;
      }

      results.metrics.typeproportion = results.metrics.dynamicreqs / results.metrics.reqs;
      if (results.metrics.typeproportion > 1) {
        results.metrics.typeproportion = 1;
      }

      callback();
    });
  }

  postProcessing(req) {
    return;
  };

  printMaxs() {
    this.print('Maximum hosts: ' + this.maxFloatingInputs[0]);
    this.print('Maximum requests: ' + this.maxFloatingInputs[1]);
  }

  isSuspicious(results) {
    return results.metrics.hosts > 30 ||
      (results.address.foreign === 0 && results.metrics.reqs > 1000 && results.metrics.verbsproportion > 0.9) ||
      (results.address.foreign === 1 && results.metrics.reqs > 500 && results.metrics.typeproportion > 0.9) ||
      (results.address.foreign === 1 && results.metrics.reqs > 100 && results.metrics.verbsproportion > 0.8);
  }
}

module.exports = IPBrain;