'use strict';

const _ = require('lodash');
const similarity = require('similarity');

const request = require('./request');

class AwesomeListBaseScraper {
  getLibrariesForQuery(query) {
    return request
      .get(this.url, { format: 'html' })
      .map($ => _(this._parseCategories($))
        .map(category => this._parseLibraries($, category))
        .flatten()
        .map(library => {
          let score = Math.max(
            similarity(library.title, query),
            similarity(library.description, query),
            similarity(library.category, query)
          );
          if (query.length > 15 && library.description.indexOf(query) > -1) {
            score = Math.max(0.6, score);
          }

          return _.set(library, 'score', score);
        })
        .filter(({ score }) => score >= 0.6)
        .sortBy('title')
        .reverse()
        .sortBy('score')
        .reverse()
        .value()
      );
  }

  _parseCategories($) {
    const categoriesListNode = $(this._categoriesListSelector).next('ul');

    return this.constructor._categoriesForList($, categoriesListNode);
  }

  _parseLibraries($, category) {
    const librariesListNode = $(`#user-content-${category.slug}`)
      .parent()
      .nextAll('ul')
      .first();

    return this.constructor
      ._librariesForList($, librariesListNode)
      .map(library => _.set(library, 'category', category.title));
  }

  static _categoriesForList($, listNode) {
    return listNode
      .children()
      .map((i, el) => {
        const anchorNode = $(el).find('> a');
        const category = {
          title: anchorNode.text(),
          slug: anchorNode.attr('href').replace('#', '')
        };
        const sublistNode = $(el).find('> ul');
        if (sublistNode.get().length > 0) {
          category.subcategories = this._categoriesForList($, sublistNode);
        }

        return category;
      })
      .get();
  }

  static _librariesForList($, listNode) {
    return listNode
      .children()
      .map((i, el) => this._parseLibrary($, el))
      .get()
      .filter(library => !!library);
  }

  static _parseLibrary($, libraryNode) {
    return null;
  }
}

module.exports = AwesomeListBaseScraper;
