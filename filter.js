module.exports = function (data) {
  var skip = false;
  if (data.req.host.indexOf('example.com') >= 0) {
    skip = true;
  }
  if (data.req.host.indexOf('domain.com') === 0 && data.req.path.indexOf('admin') >= 0) {
    skip = true;
  }
  return skip;
}