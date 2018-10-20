const Redis = require('redis');
const figlet = require('figlet');

class Station {
  constructor() {
    console.log('-----------------');
    console.log(figlet.textSync('wafode', {
      font: 'Ghost',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 80,
      whitespaceBreak: true
    }));
    console.log('-----------------');

    this.trainer = undefined;
    this.brains = [];
    this.filters = [];
    this.reqs = 0;
    this.started = false;

    var redisHost = process.env.REDIS || process.env.HOST;
    console.log('(STATION) Connecting main Redis at ' + redisHost + '...');
    this.redis = Redis.createClient({
      'host': redisHost,
      'port': 6379,
      'password': process.env.REDIS_PASSWORD || process.env.PASSWORD,
      'db': process.env.REDIS_DB || 0
    });

    this.redisp = Redis.createClient({
      'host': redisHost,
      'port': 6379,
      'password': process.env.REDIS_PASSWORD || process.env.PASSWORD,
      'db': process.env.REDIS_DB || 0
    });

    console.log('(STATION) Connected to firehose...');
  }

  addBrain(brain) {
    this.brains.push(brain);
  }

  generateDataset(trainer, brain, callback) {
    trainer.initialize(brain);
    this.trainer = trainer;

    if (this.started === false) {
      this.start();
    }

    this.trainer.on('scrapingdone', function (trainset) {
      callback(trainset);
    });
  }

  loadFilter(filter) {
    this.filters.push(filter);
  }

  processFilters(req, callback) {
    var self = this;
    var allowed = false;
    var i = 0;

    if (self.filters.length === 0) {
      return callback(true);
    } else {
      function next() {
        if (i >= self.filters.length) {
          callback(allowed);
          return;
        }

        self.filters[i++](req, function (result) {
          if (result === true) {
            allowed = true;
          }
          next();
        });
      }

      next();
    }
  }

  start() {
    var self = this;
    this.started = true;

    setInterval(function () {
      self.redisp.set('wafode_reqs', self.reqs / 30);
      self.reqs = 0;
    }, 30000);

    this.redis.on("error", function (error) {
      console.error(error);
    });

    this.redis.on('message', function (channel, message) {
      self.reqs++;
      var req;
      try {
        req = JSON.parse(message);
      } catch (error) {
        console.log('INVALID JSON');
        console.log(message);
        return;
      }

      req.processors = {};

      req.ip = req.remote_addr;

      var host = req.http_host || req.host || req.hostname;
      req.host = host.replace('"', '');

      if (req.request_method) {
        req.method = req.request_method;
        delete req.request_method;
      }

      if (req.request_uri) {
        req.path = req.request_uri;
        delete req.request_uri;
      }

      delete req.remote_user;
      delete req.http_method;
      delete req.request_time;
      delete req.upstream_response_time;

      if (req.ip === '127.0.0.1') {
        return;
      }

      self.processFilters(req, function (allowed) {
        if (allowed === true) {
          //console.log(req);
          if (self.trainer !== undefined) {
            self.trainer.process(req);
          } else {
            for (let i = 0; i < self.brains.length; i++) {
              self.brains[i].process(req);
            }
          }
        }
      });

    });

    this.redis.subscribe('httpok');

    console.log('(STATION) Data streaming initiated...');
  }

  publish(data, domain) {
    this.redisp.publish(domain || 'wafode', JSON.stringify(data));
  }
}


module.exports = Station;