const Redis = require('redis');
var synaptic = require('synaptic');
var async = require('async');
var dateFormat = require('dateformat');
var fs = require('fs');
const EventEmitter = require('events');

class Brain extends EventEmitter {
  constructor() {
    super();

    this.processors = [];
    this.maxFloatingInputs = [];

    var redisHost = process.env.REDISI || process.env.REDIS || process.env.HOST;
    console.log('(BRAIN) Connecting brain Redis at ' + redisHost + '...');
    this.localRedis = Redis.createClient({
      'host': redisHost,
      'port': 6379,
      'password': process.env.PASSWORDI_PASSWORD || process.env.PASSWORD,
      'db': 0
    });

    this.loaded = false;

    this.trained = false;
    this.training = false;

    this.coach = undefined;

    this.performance = 0.95;

    this.filters = [];

    this.name = 'brain';
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

  process(req, callback) {
    var self = this;
    async.map(self.processors, function (processor, next) {
      processor.process(req, next);
    }, function (err, results) {
      if (err) {
        self.print(err);
      } else {
        var finalResults = {};
        for (let i = 0; i < results.length; i++) {
          Object.assign(finalResults, results[i]);
        }

        self.processFilters(finalResults, function (allowed) {
          if (allowed === true) {
            self.preProcessing(req, finalResults, function () {
              var inputs = self.buildInputs(finalResults);

              //Creating training datasets
              if (callback !== undefined) {
                callback(inputs, finalResults);
              } else if (self.trained === true) {
                var dataset = self.normalizeMember({
                  'input': [...inputs[0], ...inputs[1]]
                });
                var output = self.network.activate(dataset.input);

                if (output > self.performance) {
                  self.postProcessing(req);

                  var data = { 'name': self.name, 'req': req, 'results': finalResults, 'input': dataset.input, 'output': output };

                  self.localRedis.get(req.ip + '_bad_reqs', function (err, badreqs) {
                    if (badreqs !== null) {
                      data.extraOutput = { 'badreqs': parseInt(badreqs) };
                    } else {
                      data.extraOutput = { 'badreqs': 0 };
                    }

                    self.emit('hit', data);
                  });
                }
              }
            });
          }
        });
      }
    });
  }


  save(callback) {
    var self = this;
    var output = {
      'network': this.network.toJSON()
    };

    output.metadata = this.maxFloatingInputs;

    var json = JSON.stringify(output);
    var now = new Date();

    fs.writeFile('./networks/' + this.name + '_nn_' + dateFormat(now, 'ddmmyy_HHMMss') + '.json', json, 'utf8', function () {
      if (callback) {
        self.print('Neural network saved!');
        callback();
      }
    });
  }

  load(packet) {
    this.network = synaptic.Network.fromJSON(packet.network);
    this.trainset = [];
    this.maxFloatingInputs = packet.metadata;
    this.loaded = true;
    this.trained = true;
    this.print('Neural network loaded!');
  }

  train(trainset) {
    this.training = true;

    var trainingOptions = {
      rate: .2,
      iterations: 40000,
      error: .005,
      shuffle: true
    }

    var trainer = new synaptic.Trainer(this.network);
    trainer.train(trainset, trainingOptions);

    this.trained = true;
    this.training = false;
  }

  print(text) {
    console.log('(' + this.name + ') ' + text);
  }

  normalizeMember(member) {
    for (let y = 0; y < this.maxFloatingInputs.length; y++) {
      member.input[y] = member.input[y] / this.maxFloatingInputs[y];
      member.input[y] = (member.input[y] > 1) ? 1 : member.input[y];
    }

    return member;
  }
}

module.exports = Brain;