var SECOND = 1000;
var MINUTE = 60 * SECOND;
var HOUR = 60 * MINUTE;

var MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

var NUM_SUFFIX = ['th', 'st', 'nd', 'rd'];

function numSuffix(num) {
  if (num > 3 && num < 21 || num % 10 > 3) {
    return NUM_SUFFIX[0];
  }
  return NUM_SUFFIX[num % 10];
}

function renderTime(date) {
  var hour = date.getHours();
  var minute = date.getMinutes();

  if (minute === 0) {
    if (hour === 0) {
      return null;
    }
    if (hour === 12) {
      return 'noon';
    }
  }

  var m = hour < 12 ? 'am' : 'pm';
  hour = (((hour + 23) % 12) + 1);
  return '' + hour + ':' + (minute < 10 ? '0' : '') + minute + m;
}

var DateFormatter = {
  format: function(milliseconds) {
    var now_milliseconds = Date.now();
    var now = new Date(now_milliseconds);
    var date = new Date(milliseconds);
    var delta = now_milliseconds - milliseconds;
    if (delta > 0) {
      if (delta < 5 * MINUTE) {
        return 'just now';
      }
      if (delta < 45 * MINUTE) {
        var minutes = Math.round(delta / MINUTE);
        return minutes + ' minutes ago';
      }
      if (delta < 91 * MINUTE) {
        return 'about an hour ago';
      }
      if (delta < 6 * HOUR) {
        var hours = Math.round(delta / HOUR);
        return hours + ' hours ago';
      }
      if (delta < 24 * HOUR && now.getDay() === date.getDay()) {
        var time_str = renderTime(date);
        if (time_str) {
          return 'at ' + time_str;
        }
        return 'today';
      }
    }
    var date_str = MONTHS[date.getMonth()] + ' ' +
      date.getDate() + numSuffix(date.getDate()) +
      (now.getYear() === date.getYear() ? '' : ', ' + (date.getYear() + 1900));
    var time_str = renderTime(date);
    if (time_str) {
      date_str += ' at ' + time_str;
    }
    return date_str;
  },

  formatTime: function(milliseconds) {
    return renderTime(new Date(milliseconds));
  }
};

module.exports = DateFormatter;
