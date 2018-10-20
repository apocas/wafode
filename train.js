var IPBrain = require('./lib/brains/ipbrain');
var RequestBrain = require('./lib/brains/requestbrain');
var Station = require('./lib/station');
var Collector = require('./lib/collector');

var station = new Station();
var collector = new Collector(1000, 0.4);

/*
station.loadFilter(function (req, callback) {
  //example
  if (req.host.indexOf('example.com') > -1) {
    callback(true);
  }
});
*/

var ipbrain = new IPBrain(0.98);
var requestbrain = new RequestBrain(0.95);

/*
requestbrain.isSuspicious = function (results) {
  //example
  return results.path.querystringparams > 100;
}
*/

var brain = requestbrain;

station.generateDataset(collector, brain, function (dataset) {
  brain.train(dataset);
  brain.save(function () {
    process.exit(0);
  });
});
