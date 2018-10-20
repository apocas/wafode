const net = require('net');
const Reader = require('@maxmind/geoip2-node').Reader;
var Toolbox = require('../toolbox');
var cdn = require('../../config/cdn.json');

var Address = function () {
  var self = this;
  this.ready = 0;

  Reader.open(__dirname + '/../../databases/GeoLite2-Country.mmdb').then(reader => {
    self.countryReader = reader;
    self.ready++;
  });

  Reader.open(__dirname + '/../../databases/GeoLite2-ASN.mmdb').then(reader => {
    self.asnReader = reader;
    self.ready++;
  });
};

Address.prototype.process = function (req, callback) {
  if (this.ready < 2) return callback('not ready');

  if (req.processors.address !== undefined) {
    if (callback) return callback(null, { 'address': req.processors.address })
  }

  var output = {};

  try {
    const response = this.asnReader.asn(req.ip);
    output.asn = response.autonomousSystemNumber;

    if (Toolbox.countMatches(output.asn, cdn) > 0) {
      if (req.http_x_forwarded_for && net.isIP(req.http_x_forwarded_for) > 0) {
        req.ip = req.http_x_forwarded_for;
        req.cdn = true;
      }
    }

    output.country = this.countryReader.country(req.ip).country.isoCode;
    if (output.country && output.country !== process.env.COUNTRY) {
      output.foreign = 1;
    } else {
      output.foreign = 0;
    }
  } catch (error) {
    output.country = output.country || 'unknown';
    output.asn = output.asn || 'unknown';
    if (output.foreign === undefined) {
      output.foreign = 1;
    }
  }

  req.processors.address = output;

  if (callback) callback(null, { 'address': output });
}

module.exports = Address;