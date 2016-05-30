const defaultBeforeFetch = ({ action }) => Promise.resolve({ action });
const defaultAfterFetch = ({ action, result }) => Promise.resolve({ action, result });
const rejectHandler = ({ action, error }) => Promise.reject({ action, error });

function hasOwn(obj, ...properties) {
  return properties.every(p => obj.hasOwnProperty(p));
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
export default function createFetchMiddleware(options = {}) {
  const { beforeFetch = defaultBeforeFetch, afterFetch = defaultAfterFetch, onReject = rejectHandler } = options;
  return () => next => action => {
    if (!action.url || !action.types) {
      return next(action);
    }

    const [loadingType, successType, failureType] = action.types;

    if (loadingType) {
      try {
        next({
          ...action,
          type: loadingType,
        });
      } catch (err) {
        console.error(`[fetch-middleware] Uncaught error while dispatching \`${loadingType}\`\n`, err.stack);
      }
    }

    let beforeFetchResult;
    try {
      beforeFetchResult = beforeFetch({ action });
    } catch (err) {
      throw new Error('[fetch-middleware] Uncaught error in `beforeFetch` middleware', err.stack);
    }

    if (!(beforeFetchResult instanceof Promise)) {
      throw new TypeError('[fetch-middleware] `beforeFetch` middleware returned a non-Promise object, instead got:',
                          beforeFetchResult);
    }

    return beforeFetchResult
    .then(args => {
      if (!args || typeof args !== 'object' || !hasOwn(args, 'action')) {
        console.error('[fetch-middleware] `beforeFetch` should resolve an object containing `action` key, instead got:',
                      args);
        return Promise.reject(args);
      }
      return args;
    })
    .then(
      ({ action }) => {
        const { url, init } = action;
        return fetch(url, init).then(
          result => {
            return Promise.resolve({
              action,
              result,
            });
          },
          err => {
            return Promise.reject({
              action,
              error: err,
            });
          }
        );
      }
    )
    .then(
      ({ action, result }) => {
        let afterFetchResult;
        try {
          afterFetchResult = afterFetch({ action, result });
        } catch (err) {
          console.error('[fetch-middleware] Uncaught error in `afterFetch` middleware\n', err.stack);
        }

        if (!(afterFetchResult instanceof Promise)) {
          console.error('[fetch-middleware] `afterFetch` middleware returned a non-Promise object');
          return Promise.reject();
        }

        return afterFetchResult;
      }
    )
    .then(args => {
      if (!args || typeof args !== 'object' || !hasOwn(args, 'action', 'result')) {
        console.error('[fetch-middleware] `afterFetch` should resolve an object ' +
                      'containing `action` and `result` key, instead got',
                      args);
        return Promise.reject(args);
      }
      return args;
    })
    .catch(err => {
      if (err instanceof Error || typeof err !== 'object' || !hasOwn(err, 'action', 'error')) {
        return onReject({
          action,
          error: err,
        });
      }

      return onReject(err);
    })
    .then(
      ({ action, result }) => {
        try {
          next({
            ...action,
            payload: result,
            type: successType,
          });
        } catch (err) {
          console.error(`[fetch-middleware] Uncaught error while dispatching \`${successType}\`\n`, err.stack);
        }

        return Promise.resolve(result);
      }
    )
    .catch(
      ({ action, error }) => {
        if (failureType) {
          try {
            next({
              ...action,
              type: failureType,
              error,
            });
          } catch (err) {
            console.error(`[fetch-middleware] Uncaught error while dispatching \`${failureType}\`\n`, err.stack);
          }
        }

        return Promise.reject(error);
      }
    );
  };
}

export * from './applyFetchMiddleware';
