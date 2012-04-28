var instance_count = 0;
module.exports.method = function memoizeMethod(fn) {
  var id = ++instance_count;
  return function() {
    var cache = this.__c || (this.__c = []);
    return cache[id] || (cache[id] = fn.apply(this, arguments));
  };
}
