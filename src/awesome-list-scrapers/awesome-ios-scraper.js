'use strict';

const AwesomeListBaseScraper = require('../awesome-list-base-scraper');

class AwesomeIosScraper extends AwesomeListBaseScraper {
  constructor(...args) {
    super(...args);

    this.platform = 'ios';
    this.url = 'https://github.com/vsouza/awesome-ios';
    this._categoriesListSelector = 'li > a[href="#libraries-and-frameworks"]';
  }

  static _parseLibrary($, libraryNode) {
    const anchorNode = $(libraryNode).find('> a');
    const emojiNode = $(libraryNode).find('> img');
    const title = anchorNode.text();

    const swift = emojiNode.get().length &&
      emojiNode.attr('title') === ':large_orange_diamond:';

    if (!swift) return null;

    return {
      title,
      link: anchorNode.attr('href'),
      description: $(libraryNode).text().replace(`${title} - `, '').trim(),
      source: 'awesome-ios'
    };
  }
}

module.exports = AwesomeIosScraper;
