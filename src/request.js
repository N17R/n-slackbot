'use strict';

const _ = require('lodash');
const cheerio = require('cheerio');
const got = require('got');
const Rx = require('rx-lite');

const Package = require('../package.json');

const request = (url, options = {}) => {
  const observable = Rx.Observable
    .fromPromise(got(url, _(options)
      .omit(['format'])
      .merge({
        headers: {
          'User-Agent': `${Package.name}v${Package.version}`
        },
        encoding: null
      })
      .value()
    ))
    .map(({ body }) => body)
    .catch(err => Rx.Observable
      .throw(new Error(`${url} can't be reached: ${err.message}`))
    );

  switch (options.format) {
    case 'json': return observable.map(body => JSON.parse(body));
    case 'html': return observable.map(body => cheerio.load(body));
    default: return observable;
  }
};

const methods = [
  'get',
  'post',
  'put',
  'patch',
  'head',
  'delete'
];

methods.forEach(method => {
  request[method] = (url, options) => request(
    url, _.assign({}, options, { method })
  );
});

module.exports = request;
