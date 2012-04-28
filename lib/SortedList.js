function SortedList(comparator) {
  this._comparator = comparator || defaultComparator;
  this._list = [];
}

module.exports = SortedList;

function defaultComparator(a, b) {
  return a > b;
}

SortedList.prototype.add = function(item) {
  for (var ii = 0; ii < this._list.length; ++ii) {
    if (this._comparator(item, this._list[ii])) {
      this._list.splice(ii, 0, item);
      return;
    }
  }
  this._list.push(item);
};

SortedList.prototype.remove = function(item) {
  for (var ii = 0; ii < this._list.length; ++ii) {
    if (this._list[ii] == item) {
      this._list.splice(ii, 1);
      return;
    }
  }
};

SortedList.prototype.getArray = function() {
  return this._list;
};

SortedList.prototype.getAfter = function(fn) {
  for (var ii = 0; ii < this._list.length; ++ii) {
    if (fn(this._list[ii])) {
      return ii ? this._list.slice(ii) : this._list;
    }
  }
  return [];
};
