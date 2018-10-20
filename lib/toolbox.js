const dns = require('dns');

module.exports = {
  shuffle: function (arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  },
  draft: function (arr, n) {
    var result = new Array(n);
    var len = arr.length;
    var taken = new Array(len);
    if (n > len) {
      throw new RangeError("getRandom: more elements taken than available");
    }
    while (n--) {
      var x = Math.floor(Math.random() * len);
      result[n] = arr[x in taken ? taken[x] : x];
      taken[x] = --len in taken ? taken[len] : len;
    }
    return result;
  },
  countMatches: function (str, data) {
    var count = 0;
    str = '' + str;
    for (let i = 0; i < data.length; i++) {
      count += str.split(data[i]).length - 1;
    }
    return count;
  },
  countStartsMatches: function (str, data) {
    var count = 0;
    str = '' + str;
    for (let i = 0; i < data.length; i++) {
      count += (str.indexOf(data[i]) === 0) ? 1 : 0;
    }
    return count;
  },
  isCrawler: function (redis, ip, callback) {
    redis.sismember('wafode_crawlers', ip, function (err, crawlerlisted) {
      if (crawlerlisted === 1) {
        return callback(true);
      } else {
        dns.reverse(ip, function (err, host) {
          if (!err && host && (host[0].indexOf('search.msn.com') > 0 || host[0].indexOf('googlebot.com') > 0)) {
            var ptr = host[0];
            dns.resolve(ptr, function (err, records) {
              if (!err) {
                //console.log('RESOLVED: ' + ip);
                //console.log(host[0]);
                //console.log(records[0]);
                if (records[0] === ip) {
                  console.log('NEW CRAWLER DETECTED ' + ip + ' ' + host[0]);
                  redis.sadd('wafode_crawlers', ip);

                  var aux = {'action': 'crawler', 'data': ip};
                  redis.publish('wafode_news', JSON.stringify(aux));
                  
                  return callback(true);
                }
              } else {
                console.log('FAILED TO RESOLVE IP: ' + ip);
              }
              return callback();
            });
          } else {
            return callback();
          }
        });
      }
    });
  }
}