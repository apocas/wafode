var IPBrain = require('./brains/ipbrain');
var RequestBrain = require('./brains/requestbrain');
var Station = require('./station');
var Toolbox = require('./toolbox');
var customFilter = require('./filter');
const { IncomingWebhook } = require('@slack/webhook');
const fetch = require('node-fetch');

var whitelist = require('../config//whitelist.json')
var asnwhitelist = require('../config/asnwhitelist.json');
var countrieswhitelist = require('../config/countrieswhitelist.json');

class Waf {
  constructor() {
    this.station = new Station();

    this.slack = new IncomingWebhook(process.env.SLACK_URL);

    this.ipbrain = new IPBrain(0.95);
    this.requestbrain = new RequestBrain(0.98);

    if (process.env.DEBUG) {
      console.log('(WAFODE) DEBUG mode enabled!');
    }
  }

  async checkip(ip) {
    const data = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`, {
      method: 'get',
      headers: { 'Accept': 'application/json', 'Key': process.env.ABUSEIPDB_KEY }
    }).then(res => res.json())
    return data;
  }

  print(data) {
    console.log('#########################');
    console.log(data.req);
    console.log('------------');
    console.log(data.results);
    console.log('------------');
    console.log(data.input);
    console.log('------------');
    console.log(data.output);
    console.log('------------');
    console.log(data.extraOutput);
    console.log('#########################');
  }

  blacklist(ip, country, score) {
    if (process.env.DEBUG) {
      console.log('Blacklisting ' + ip + ' for ' + country + ' with score ' + score);
      return;
    }
    var self = this;
    self.station.redisp.sismember('wafode_deny', ip, function (err, blacklisted) {
      if (blacklisted !== 1) {
        self.station.redisp.sadd('wafode_deny_buffer', ip);
        if (score && score.length > 0) {
          self.station.redisp.hset('wafode_deny_buffer_data', ip, score[0]);
        }
      }
    });
  }

  isWhitelisted(data) {
    var skip = false;
    if (Toolbox.countStartsMatches(data.req.ip, whitelist) > 0) {
      skip = true;
    }
    if (Toolbox.countMatches(data.results.address.asn, asnwhitelist) > 0) {
      skip = true;
    }
    if (Toolbox.countMatches(data.results.address.country, countrieswhitelist) > 0) {
      skip = true;
    }
    return skip;
  }

  start() {
    try {
      this.ipbrain.load(require(process.env.IP_NN));
      this.requestbrain.load(require(process.env.REQUEST_NN));
    } catch (error) {
      console.log('(WAF) Failed to load neural networks!');
      process.exit(1);
    }

    var filter = function (data, callback) {
      if (data.path.isdynamic === 0) {
        callback(false);
      } else {
        callback(true);
      }
    };

    this.ipbrain.loadFilter(filter);
    this.requestbrain.loadFilter(filter);

    this.ipbrain.initializeProcessors();
    this.requestbrain.initializeProcessors();

    this.station.addBrain(this.ipbrain);
    this.station.addBrain(this.requestbrain);

    var self = this;

    this.ipbrain.on('hit', function (data) {
      if (data.results.useragent.agent !== 'bot' && data.results.useragent.agent !== 'unknown') {
        var skip = customFilter(data);

        if ((data.input[4] < 0.7 || data.input[3] <= 0.3)) { //scrapping
          skip = true;
        }

        skip = self.isWhitelisted(data);

        self.station.redisp.sismember('wafode_whitelist', data.req.ip, function (err, whitelisted) {
          if (whitelisted === 1) {
            skip = true;
          }

          Toolbox.isCrawler(self.station.redisp, data.req.ip, function (crawler) {
            if (crawler === true) {
              skip = true;
            }

            var decision = 'watching';

            if (skip === false && process.env.DENY && data.results.metrics.hosts >= 20) {
              decision = 'blacklisted';
              self.blacklist(data.req.ip, data.results.address.country, data.output);
            }

            if (process.env.PUBLISH) {
              var output = { 'time_local': data.req.time_iso8601 || data.req.time_local, 'neuralnetwork': 'ipbrain', 'ip': data.req.ip, 'host': data.req.host, 'request': data.req.request, 'posts': data.input[3] * 100, 'dynamic': data.input[4] * 100, 'hosts': data.results.metrics.hosts, 'requests': data.results.metrics.reqs, 'badrequests': data.extraOutput.badreqs, 'country': data.results.address.country, 'status': data.req.status, 'hostname': data.req.hostname, 'decision': decision, 'asn': data.results.address.asn };

              self.station.publish(output);
            }
          });
        });
      }
    });

    this.requestbrain.on('hit', async function (data) {
      //console.log(data);
      if (data.results.useragent.agent !== 'bot' && data.results.useragent.agent !== 'unknown') {
        var skip = customFilter(data);

        if (data.extraOutput.badreqs < 5) {
          skip = true;
        }

        skip = self.isWhitelisted(data);

        self.station.redisp.sismember('wafode_whitelist', data.req.ip, function (err, whitelisted) {
          if (whitelisted === 1) {
            skip = true;
          }

          Toolbox.isCrawler(self.station.redisp, data.req.ip, function (crawler) {
            if (crawler === true) {
              skip = true;
            }

            var decision = 'watching';

            if (skip === false && process.env.DENY && data.extraOutput.badreqs >= 25) {
              decision = 'blacklisted';
              self.blacklist(data.req.ip, data.results.address.country, data.output);
            }

            if (process.env.PUBLISH) {
              var output = { 'time_local': data.req.time_iso8601 || data.req.time_local, 'neuralnetwork': 'requestbrain', 'ip': data.req.ip, 'host': data.req.host, 'request': data.req.request, 'badrequests': data.extraOutput.badreqs, 'country': data.results.address.country, 'status': data.req.status, 'hostname': data.req.hostname, 'decision': decision, 'asn': data.results.address.asn };

              self.station.publish(output);
            }
          });
        });
      }
    });

    this.station.start();
  }
}

module.exports = Waf;