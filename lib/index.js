'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

exports.default = createFetchMiddleware;

var _applyFetchMiddleware = require('./applyFetchMiddleware');

Object.keys(_applyFetchMiddleware).forEach(function (key) {
  if (key === "default") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _applyFetchMiddleware[key];
    }
  });
});
var defaultBeforeFetch = function defaultBeforeFetch(_ref) {
  var action = _ref.action;
  return Promise.resolve({ action: action });
};
var defaultAfterFetch = function defaultAfterFetch(_ref2) {
  var action = _ref2.action;
  var result = _ref2.result;
  return Promise.resolve({ action: action, result: result });
};
var rejectHandler = function rejectHandler(_ref3) {
  var action = _ref3.action;
  var error = _ref3.error;
  return Promise.reject({ action: action, error: error });
};

function hasOwn(obj) {
  for (var _len = arguments.length, properties = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    properties[_key - 1] = arguments[_key];
  }

  return properties.every(function (p) {
    return obj.hasOwnProperty(p);
  });
}

/**
 * Create a fetch middleware
 *
 * @param {object} options Options for creating fetch middleware
 *   @param  {function} beforeFetch Injection point before sending request, it should return a Promise
 *   @param  {function} afterFetch  Injection point after receive response, it should return a Promise
 *   @param  {function} onReject    Injection point when anything goes wrong, it should return a Promise
 * @return {function}
 */
function createFetchMiddleware() {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  var _options$beforeFetch = options.beforeFetch;
  var beforeFetch = _options$beforeFetch === undefined ? defaultBeforeFetch : _options$beforeFetch;
  var _options$afterFetch = options.afterFetch;
  var afterFetch = _options$afterFetch === undefined ? defaultAfterFetch : _options$afterFetch;
  var _options$onReject = options.onReject;
  var onReject = _options$onReject === undefined ? rejectHandler : _options$onReject;

  return function () {
    return function (next) {
      return function (action) {
        if (!action.url || !action.types) {
          return next(action);
        }

        var _action$types = _slicedToArray(action.types, 3);

        var loadingType = _action$types[0];
        var successType = _action$types[1];
        var failureType = _action$types[2];


        if (loadingType) {
          try {
            next(_extends({}, action, {
              type: loadingType
            }));
          } catch (err) {
            console.error('[fetch-middleware] Uncaught error while dispatching `' + loadingType + '`\n', err.stack);
          }
        }

        var beforeFetchResult = void 0;
        try {
          beforeFetchResult = beforeFetch({ action: action });
        } catch (err) {
          throw new Error('[fetch-middleware] Uncaught error in `beforeFetch` middleware', err.stack);
        }

        if (!(beforeFetchResult instanceof Promise)) {
          throw new TypeError('[fetch-middleware] `beforeFetch` middleware returned a non-Promise object, instead got:', beforeFetchResult);
        }

        return beforeFetchResult.then(function (args) {
          if (!args || (typeof args === 'undefined' ? 'undefined' : _typeof(args)) !== 'object' || !hasOwn(args, 'action')) {
            console.error('[fetch-middleware] `beforeFetch` should resolve an object containing `action` key, instead got:', args);
            return Promise.reject(args);
          }
          return args;
        }).then(function (_ref4) {
          var action = _ref4.action;
          var url = action.url;
          var init = action.init;

          return fetch(url, init).then(function (result) {
            return Promise.resolve({
              action: action,
              result: result
            });
          }, function (err) {
            return Promise.reject({
              action: action,
              error: err
            });
          });
        }).then(function (_ref5) {
          var action = _ref5.action;
          var result = _ref5.result;

          var afterFetchResult = void 0;
          try {
            afterFetchResult = afterFetch({ action: action, result: result });
          } catch (err) {
            console.error('[fetch-middleware] Uncaught error in `afterFetch` middleware\n', err.stack);
          }

          if (!(afterFetchResult instanceof Promise)) {
            console.error('[fetch-middleware] `afterFetch` middleware returned a non-Promise object');
            return Promise.reject();
          }

          return afterFetchResult;
        }).then(function (args) {
          if (!args || (typeof args === 'undefined' ? 'undefined' : _typeof(args)) !== 'object' || !hasOwn(args, 'action', 'result')) {
            console.error('[fetch-middleware] `afterFetch` should resolve an object ' + 'containing `action` and `result` key, instead got', args);
            return Promise.reject(args);
          }
          return args;
        }).catch(function (err) {
          if (err instanceof Error || (typeof err === 'undefined' ? 'undefined' : _typeof(err)) !== 'object' || !hasOwn(err, 'action', 'error')) {
            return onReject({
              action: action,
              error: err
            });
          }

          return onReject(err);
        }).then(function (_ref6) {
          var action = _ref6.action;
          var result = _ref6.result;

          try {
            next(_extends({}, action, {
              payload: result,
              type: successType
            }));
          } catch (err) {
            console.error('[fetch-middleware] Uncaught error while dispatching `' + successType + '`\n', err.stack);
          }

          return Promise.resolve(result);
        }).catch(function (_ref7) {
          var action = _ref7.action;
          var error = _ref7.error;

          if (failureType) {
            try {
              next(_extends({}, action, {
                type: failureType,
                error: error
              }));
            } catch (err) {
              console.error('[fetch-middleware] Uncaught error while dispatching `' + failureType + '`\n', err.stack);
            }
          }

          return Promise.reject(error);
        });
      };
    };
  };
}