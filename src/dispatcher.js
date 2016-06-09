'use strict';

const { expect } = require('code');
const clark = require('clark');
const Rx = require('rx-lite');

const Bot = require('./bot');
const Brain = require('./brain');
const Logger = require('./logger');
const Redis = require('redis');

const redisPort = process.env.NODE_ENV === 'production'
  ? process.env.REDIS_PORT
  : 6379;
const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

const greetings = [
  'Hey there!',
  'Greetings, human!',
  'Yo!',
  'Salem!',
  'Privet!'
];

class Dispatcher {
  constructor(controller) {
    this._bot = new Bot(controller);
    this._logger = new Logger(logLevel, ['dispatcher']);
    this._brain = new Brain({
      redisClient: Redis.createClient({ port: redisPort }),
      logger: new Logger(logLevel, ['redis'])
    });

    this._commands = {
      greet: {
        actions: ({ user, channel }) => {
          const greeting = `@${user.name}: ` +
            greetings[Math.floor(Math.random() * greetings.length)];

          return this._bot.sayMessage({
            channel: channel.id,
            text: greeting
          });
        },
        description: 'Greeting'
      },
      vote: {
        validate: ({ votedUser, operator }) => !!votedUser &&
          ['++', '--'].indexOf(operator || '') > -1,
        actions: ({ votedUser, user, channel, operator }) => {
          let getVotedUser;
          if (votedUser.id) {
            getVotedUser = this._getUser(votedUser.id);
          } else if (votedUser.name) {
            getVotedUser = this._findUser(votedUser.name);
          } else {
            getVotedUser = this._brain.getLastVotedUser(channel.id);
          }

          return getVotedUser
            .flatMap(votedUser => {
              const vote = this.constructor._parseVote({
                votedUser,
                operator,
                votingUser: user
              });

              return this
                ._bot.sayMessage({
                  channel: channel.id,
                  text: vote.message
                })
                .flatMap(response => this._updateUserScore({
                  channel: channel.id,
                  userId: votedUser.id,
                  points: vote.points
                }))
                .doOnNext(scores => {
                  const direction = operator === '++' ? 'up' : 'down';
                  this._logger.info(`User ${user.name} ` +
                    `${direction}voted user ${votedUser.name}`);
                });
            });
        },
        description: 'Processing vote'
      },
      userScore: {
        validate: ({ requestedUser }) => !!requestedUser &&
          (requestedUser.name || requestedUser.id),
        actions: ({ requestedUser, channel }) => {
          let getUser;
          if (requestedUser.id) {
            getUser = this._getUser(requestedUser.id);
          } else if (requestedUser.name) {
            getUser = this._findUser(requestedUser.name);
          }

          return getUser.flatMap(user => this._brain
            .getUserScore(user.id)
            .flatMap(score => this._bot.sayMessage({
              channel: channel.id,
              text: `@${user.name}: your score is: ${score}`
            }))
          );
        },
        description: 'Getting score'
      },
      leaderboard: {
        actions: ({ channel }) => this
          ._getUserScores()
          .flatMap(scores => this._bot.sayMessage({
            channel: channel.id,
            text: scores,
            mrkdwn: true
          })),
        description: 'Getting leaderboard'
      }
    };
  }

  runCommand(commandName, options) {
    if (!commandName || !options.channelId || !options.userId) return;

    const command = this._commands[commandName];

    Rx.Observable
      .zip(
        this._getUser(options.userId),
        this._getChannel(options.channelId)
      )
      .flatMap(([user, channel]) => {
        if (!user || !channel) {
          return Rx.Observable.empty();
        }

        delete options.userId;
        delete options.channelId;

        options.user = user;
        options.channel = channel;

        return Rx.Observable.return(options);
      })
      .filter(options => {
        if (command.validate && !command.validate(options)) {
          return false;
        }

        return true;
      })
      .doOnNext(({ user, channel }) => {
        let message = `${command.description} for user ${user.name} `;
        if (['direct message', 'private channel'].indexOf(channel.name) > -1) {
          message += `in ${channel.name}`;
        } else {
          message += `in channel ${channel.name}`;
        }

        this._logger.info(message);
      })
      .flatMap(options => command.actions(options))
      .catch(err => {
        this._logger.error(`Failed to process command ${commandName}: ${err}`);

        return this._bot.sayError(options.channelId);
      })
      .subscribe();
  }

  _getUser(userId) {
    if (!userId) {
      return Rx.Observable.return(null);
    }

    return this._brain
      .getUser(userId)
      .flatMap(user => {
        if (user) {
          return Rx.Observable.return(user);
        }

        return this._updateUsers()
          .map(users => users.find(user => user.id === userId));
      });
  }

  _findUser(username) {
    if (!username) {
      return Rx.Observable.return(null);
    }

    return this._brain
      .getUsers()
      .map(users => users.find(user => user.name === username))
      .flatMap(user => {
        if (user) {
          return Rx.Observable.return(user);
        }

        this._updateUsers()
          .map(users => users.find(user => user.name === username));
      });
  }

  _updateUsers() {
    return this._bot
      .getUsers()
      .map(users => users.map(({ id, name, is_admin, profile }) => {
        const user = {
          id,
          name,
          is_admin,
          first_name: profile.first_name,
          last_name: profile.last_name,
          real_name: profile.real_name,
          email: profile.email
        };

        Object.keys(user).forEach(key => {
          if (!user[key]) {
            delete user[key];
          }
        });

        return user;
      }))
      .flatMap(users => this._brain.saveUsers(users));
  }

  _getChannel(channelId) {
    if (!channelId) {
      return Rx.Observable.return(null);
    }

    if (channelId.charAt(0) === 'D') {
      return Rx.Observable.return({
        id: channelId,
        name: 'direct message'
      });
    } else if (channelId.charAt(0) === 'G') {
      return Rx.Observable.return({
        id: channelId,
        name: 'private channel'
      });
    }

    return this._brain
      .getChannel(channelId)
      .flatMap(channel => {
        if (channel) {
          return Rx.Observable.return(channel);
        }

        return this
          ._updateChannels()
          .map(channels => channels.find(channel => channel.id === channelId));
      });
  }

  _updateChannels() {
    return this._bot
      .getChannels()
      .map(channels => channels.map(channel => ({
        id: channel.id,
        name: channel.name
      })))
      .flatMap(channels => this._brain.saveChannels(channels));
  }

  _getUserScores() {
    return Rx.Observable
      .zip(
        this._brain.getUserScores(),
        this._brain.getUsers()
      )
      .map(([scores, users]) => Object.keys(scores || {})
        .map(userId => {
          const user = users.find(user => user.id === userId);
          const username = (user || {}).name;

          return {
            username: username ? `@${username}` : 'mystery',
            points: parseInt(scores[userId], 10)
          };
        })
        .filter(score => score.points > 0)
      )
      .map(scores => {
        if (!scores || scores.length === 0) {
          return 'No scores yet';
        }

        scores = scores.reduce((scores, score) => {
          if (scores[score.points]) {
            scores[score.points] = scores[score.points].concat(score.username);
          } else {
            scores[score.points] = [score.username];
          }

          return scores;
        }, {});

        let points = Object
          .keys(scores)
          .map(point => parseInt(point))
          .sort((a, b) => b - a);
        points = points.slice(0, Math.min(10, points.length));

        const table = points
          .map((points, i) => scores[points].map((username, j) => {
            const num = `${i + 1}.`;
            return `${j === 0 ? num : ' '.repeat(num.length)} ` +
              `${username}: ${points} point${points > 1 ? 's' : ''}` +
              (i === 0 ? ' 👑' : '');
          }))
          .reduce((a, b) => a.concat(b));

        return `${clark(points)}\n\`\`\`${table.join('\n')}\`\`\``;
      });
  }

  _updateUserScore({ channel, userId, points }) {
    if (!points) {
      return Rx.Observable.empty();
    }

    return this._brain
      .setLastVotedUser(channel, userId)
      .flatMap(lastVotedUser => this._brain.incrementUserScore(userId, points));
  }

  static _parseVote({ votingUser, votedUser, operator }) {
    expect(votingUser).to.be.an.object();
    expect(operator).to.be.a.string();

    if (!votedUser) {
      return {
        message: 'Please specify the username',
        points: 0
      };
    } else if (votingUser.id === votedUser.id) {
      return {
        message: `@${votingUser.name}: No cheating 😏`,
        points: 0
      };
    }

    switch (operator) {
      case '++':
        return {
          message: `Upvoted @${votedUser.name} 😃`,
          points: 1
        };
      case '--':
        return {
          message: `Downvoted @${votedUser.name} 😔`,
          points: -1
        };
    }
  }
}

module.exports = Dispatcher;
