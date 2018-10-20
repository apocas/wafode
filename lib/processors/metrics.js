const Redis = require('redis');

var Metrics = function () {
  this.redis = Redis.createClient({
    'host': process.env.REDIS || process.env.HOST,
    'port': 6379,
    'password': process.env.PASSWORD,
    'db': 0
  });
}

Metrics.prototype.process = function (req, callback) {
  var self = this;
  var output = {};

  if (req.processors.metrics !== undefined) {
    if (callback) return callback(null, { 'metrics': req.processors.metrics })
  }

  if (req.host) {
    this.redis.sadd(req.ip + '_hosts', req.host);
    this.redis.expire(req.ip + '_hosts', 1800);
  }

  this.redis.incr(req.ip + '_reqs');
  this.redis.expire(req.ip + '_reqs', 1800);

  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    this.redis.incr(req.ip + '_postreqs');
    this.redis.expire(req.ip + '_postreqs', 1800);
  }

  this.redis.scard(req.ip + '_hosts', function (err, counthosts) {
    output.hosts = parseInt(counthosts);

    self.redis.get(req.ip + '_reqs', function (err, countreqs) {
      output.reqs = parseInt(countreqs);

      self.redis.get(req.ip + '_postreqs', function (err, countpostreqs) {
        output.postreqs = parseInt(countpostreqs) || 0;

        output.verbsproportion = output.postreqs / output.reqs;
        if (output.verbsproportion > 1) {
          output.verbsproportion = 1;
        }

        req.processors.metrics = output;

        if (callback) callback(null, { 'metrics': output });
      });
    });
  });
}

module.exports = Metrics;