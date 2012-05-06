var util = require('util');

function expand(og_obj, prefix) {
  prefix = prefix || 'og:';
  var og_names = Object.keys(og_obj);
  var expanded_tags = [];
  for (var ii = 0; ii < og_names.length; ++ii) {
    var og_name = og_names[ii];
    var og_value = og_obj[og_name];
    if (og_value != null) {
      Array.prototype.push.apply(
        expanded_tags,
        expand_item(prefix, og_name, og_value)
      );
    }
  }
  return expanded_tags;
};

function expand_item(prefix, og_name, og_value) {
  if (!(og_value instanceof Object)) {
    og_value = [og_value];
  }
  if (util.isArray(og_value)) {
    return og_value.map(item.bind(null, prefix, og_name));
  } else {
    return expand(og_value, prefix + og_name + ':');
  }
}

function item(prefix, og_name, og_value) {
  return {
    name: prefix + og_name,
    value: og_value
  };
}

exports.expand = expand;
