'use strict';

const _ = require('lodash');
const path = require('path');
const requireAll = require('require-all');
const Rx = require('rx-lite');

const request = require('./request');

const librariesIoApiKey = process.env.LIBRARIES_IO_API_KEY;
const librariesIoUrl = 'https://libraries.io/api/search';
const librariesIoPlatforms = {
  ios: ['CocoaPods', 'Libraries'],
  android: ['Maven']
};
const librariesIosLanguages = {
  ios: ['Swift'],
  android: ['Java']
};
const scrapers = requireAll({
  dirname: path.join(__dirname, './awesome-list-scrapers'),
  resolve: Scraper => new Scraper()
});

class Librarian {
  constructor({ logger }) {
    this._logger = logger;
    this._awesomeListScrapers = _.groupBy(scrapers, 'platform');
  }

  getLibrariesForQuery(platform, query) {
    const scrapers = this._awesomeListScrapers[platform];

    return Rx.Observable
      .concat(scrapers
        .map(scraper => scraper.getLibrariesForQuery(query))
        .concat(request
          .get(librariesIoUrl, {
            query: {
              api_key: librariesIoApiKey,
              q: query,
              platforms: librariesIoPlatforms[platform].join(','),
              languages: librariesIosLanguages[platform].join(',')
            },
            format: 'json'
          })
          .map(results => _(results)
            .map(result => ({
              title: result.name,
              description: result.description,
              link: result.repository_url,
              stars: result.stars,
              packageManager: result.platform
            }))
            .sortBy('stars')
            .reverse()
            .slice(0, 10)
            .value()
          )
        )
      )
      .toArray()
      .map(libraries => _(libraries)
        .flatten()
        .uniqBy('link')
        .value()
      )
      .do(
        libraries => {
          this._logger.info(`Got ${libraries.length} ${platform} libraries ` +
            `for "${query}"`);
        },
        err => {
          this._logger.error(`Failed to get ${platform} libraries for ` +
            `"${query}": ${err.message}`);
        }
      );
  }

  static formattedPlatform(platform) {
    if (platform.toLowerCase() === 'ios') {
      return 'iOS';
    } else if (platform.toLowerCase() === 'android') {
      return 'Android';
    } else {
      return platform.replace(
        /\w\S*/g,
        str => str.charAt(0).toUpperCase() + str.substr(1).toLowerCase()
      );
    }
  }
}

module.exports = Librarian;
