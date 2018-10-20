var fs = require('fs');
var dateFormat = require('dateformat');
var Toolbox = require('./toolbox');
const EventEmitter = require('events');
var ProgressBar = require('progress');

class Collector extends EventEmitter {
  constructor(size, prop) {
    super();

    this.name = 'COLLECTOR';

    this.datasetSize = size || 40000;
    this.datasetProp = prop || 0.7;

    this.scraping = true;

    this.normalset = [];
    this.suspiciousset = [];
    this.trainset !== undefined;
  }

  initialize(brain) {
    if(this.scraping === false) {
      this.print('Collector already used!');
      process.exit(1);
    }
    this.brain = brain;
    this.brain.initializeProcessors();

    if (this.trainset !== undefined) {
      this.print('Train dataset already loaded!');
      process.exit(1);
    }

    this.print('Collecting at least ' + this.datasetSize + ' samples (' + parseInt(this.datasetSize * this.datasetProp) + ' obligatory training candidates)');

    this.progress = new ProgressBar('(' + this.name + ') Collecting candidates [:bar] :current/:total :percent :etas', { total: this.datasetSize * this.datasetProp, width: 50 });
  }

  loadDataset(packet) {
    this.trainset = packet.dataset;
    this.maxFloatingInputs = packet.metadata;
    this.printMaxs();
    this.print('Loaded dataset: ' + packet.dataset.length);
  }

  size() {
    return this.suspiciousset.length;
  }

  process(req) {
    var self = this;
    this.brain.process(req, function (inputs, finalResults) {
      if (self.scraping === true) {
        var input = self.categorize(inputs, finalResults);
        if (input.output && input.output[0] === 1) {
          console.log(req);
          self.progress.tick();
        }

        if (self.size() > self.datasetSize * self.datasetProp) {
          self.scraping = false;
          self.print('Collected ' + (self.normalset.length + self.suspiciousset.length) + ' samples');
          self.print('Selecting data for a training set...');
          self.trainset = self.team(self.datasetSize, self.datasetProp, function (dataset) {
            self.emit('scrapingdone', dataset);
          });
        }
      }
    });
  }

  categorize(inputs, results) {
    var trainset = {
      'input': [...inputs[0], ...inputs[1]]
    };

    if (this.brain.isSuspicious(results) === true) {
      trainset.output = [1];
      this.suspiciousset.push(trainset);
    } else {
      trainset.output = [0];
      this.normalset.push(trainset);
    }

    return trainset;
  }

  team(size, prop, callback) {
    var self = this;
    var team = [];

    if (size * prop > this.suspiciousset.length || size * (1 - prop) > this.normalset.length) {
      size = (this.suspiciousset.length > this.normalset.length) ? this.normalset.length : this.suspiciousset.length;
    }

    this.print('Requesting a dataset with ' + size);
    this.print('Positive sample: ' + parseInt(size * prop) + ' from ' + this.suspiciousset.length);
    this.print('Negative sample: ' + parseInt(size - (size * prop)) + ' from ' + this.normalset.length);

    team.push(...Toolbox.draft(this.suspiciousset, parseInt(size * prop)));
    team.push(...Toolbox.draft(this.normalset, parseInt(size - (size * prop))));

    this.normalizeTeam(team);
    Toolbox.shuffle(team);

    this.print('Dataset drafted: ' + team.length);

    this.saveTeam(team, function () {
      self.print('Dataset saved!');
      if (callback) {
        var output = { 'dataset': team };
        output.metadata = self.brain.maxFloatingInputs;
        callback(output);
      }
    });

    return team;
  }

  normalizeTeam(team) {
    for (let i = 0; i < team.length; i++) {
      for (let y = 0; y < this.brain.maxFloatingInputs.length; y++) {
        if (team[i].input[y] > this.brain.maxFloatingInputs[y]) {
          this.brain.maxFloatingInputs[y] = team[i].input[y];
        }
      }
    }

    this.brain.printMaxs();

    for (let i = 0; i < team.length; i++) {
      team[i] = this.brain.normalizeMember(team[i]);
    }
  }



  saveTeam(team, callback) {
    var now = new Date();

    var output = { 'dataset': team };
    output.metadata = this.brain.maxFloatingInputs;

    var json = JSON.stringify(output);

    fs.writeFile('./datasets/' + this.name + '_dataset_' + team.length + '_' + dateFormat(now, 'ddmmyy_HHMMss') + '.json', json, 'utf8', function () {
      if (callback) callback();
    });
  }

  print(text) {
    console.log('(' + this.name + ') ' + text);
  }
}

module.exports = Collector;