'use strict';

const AwesomeListBaseScraper = require('../awesome-list-base-scraper');

class AwesomeSwiftScraper extends AwesomeListBaseScraper {
  constructor(...args) {
    super(...args);

    this.platform = 'ios';
    this.url = 'https://github.com/matteocrippa/awesome-swift';
    this._categoriesListSelector = 'li > a[href="#libs"]';
  }

  static _parseLibrary($, libraryNode) {
    const anchorNode = $(libraryNode).find('> a');
    const title = anchorNode.text();

    return {
      title,
      link: anchorNode.attr('href'),
      description: $(libraryNode).text().replace(`${title} - `, '').trim(),
      source: 'awesome-swift'
    };
  }
}

module.exports = AwesomeSwiftScraper;
