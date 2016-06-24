'use strict';

const AwesomeListBaseScraper = require('../awesome-list-base-scraper');

class AwesomeAndroidScraper extends AwesomeListBaseScraper {
  constructor(...args) {
    super(...args);

    this.platform = 'android';
    this.url = 'https://github.com/JStumpp/awesome-android';
    this._categoriesListSelector = 'li > a[href="#libraries"]';
  }

  static _parseLibrary($, libraryNode) {
    const anchorNode = $(libraryNode).find('> a');
    const title = anchorNode.text();

    return {
      title,
      link: anchorNode.attr('href'),
      description: $(libraryNode).text().replace(`${title} - `, '').trim(),
      source: 'awesome-android'
    };
  }
}

module.exports = AwesomeAndroidScraper;
