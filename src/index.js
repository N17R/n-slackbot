'use strict';

const Botkit = require('botkit');
require('dotenv').config();

const Dispatcher = require('./dispatcher');
const Logger = require('./logger');

const controller = Botkit.slackbot({ logger: new Logger('info', ['botkit']) });
const dispatcher = new Dispatcher(controller);

controller.hears(
  '^(?:hi|hello|whatsup|howdy|greetings|privet|salem)(?:\\s+.*)?$',
  ['direct_message', 'direct_mention'], (bot, message) => dispatcher
    .runCommand('greet', {
      channelId: message.channel,
      userId: message.user
    })
  );

controller.hears(
  '^\\s*<@(U.+)>\\s*:?\\s*([-+]{2})\\s*$',
  ['ambient'], (bot, message) => dispatcher
    .runCommand('vote', {
      channelId: message.channel,
      userId: message.user,
      votedUser: { id: message.match[1] },
      operator: message.match[2]
    })
  );

controller.hears(
  '^\\s*@?([\\w\\.\\-]*)\\s*:?\\s*([-+]{2})\\s*$',
  ['ambient'], (bot, message) => dispatcher
    .runCommand('vote', {
      channelId: message.channel,
      userId: message.user,
      votedUser: { name: message.match[1].toLowerCase() },
      operator: message.match[2]
    })
  );

controller.on('reaction_added', (bot, message) => dispatcher
  .runCommand('vote', {
    channelId: message.item.channel,
    userId: message.user,
    votedUser: { id: message.item_user },
    operator: message.reaction
      .replace(/^\+1$/, '++')
      .replace(/^\-1$/, '--')
  })
);

controller.hears(
  '^\\s*score\\s*$',
  ['direct_message', 'direct_mention'], (bot, message) => dispatcher
    .runCommand('userScore', {
      channelId: message.channel,
      userId: message.user,
      requestedUser: { id: message.user }
    })
  );

controller.hears(
  '^\\s*score\\s+(?:for\\s+)?<@(U.+)>\\s*$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => dispatcher
    .runCommand('userScore', {
      channelId: message.channel,
      userId: message.user,
      requestedUser: { id: message.match[1] }
    })
  );

controller.hears(
  '^\\s*score\\s+(?:for\\s+)?@?(?!.*<)(.*)\\s*$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => dispatcher
    .runCommand('userScore', {
      channelId: message.channel,
      userId: message.user,
      requestedUser: { name: message.match[1] }
    })
  );

controller.hears(
  '^\\s*leaderboard\\s*$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => dispatcher
    .runCommand('leaderboard', {
      channelId: message.channel,
      userId: message.user
    })
  );
