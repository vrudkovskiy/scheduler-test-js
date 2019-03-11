const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const ScheduledMessageRepository = require('./src/ScheduledMessageRepository');
const ScheduledMessage = require('./src/ScheduledMessage');

const app = express();
let watchInterval = null;

function processMessages(repository) {
  return repository.pop(new Date())
    .then((messages) => {
      if (messages.length === 0) {
        return Promise.resolve();
      }

      messages.forEach((message) => {
        console.log(`[ Message ]: ${message}`);
      });

      return processMessages(repository);
    });
}

function stopWatching() {
  if (watchInterval) {
    clearInterval(watchInterval);
  }
}

function restartWatching(repository) {
  stopWatching();

  watchInterval = setInterval(() => {
    processMessages(repository);
  }, 1000);
}

ScheduledMessageRepository.connect('localhost', 6379)
  .then((repository) => {
    restartWatching(repository);

    // view engine setup
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'jade');

    app.use(logger('dev'));
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, 'public')));

    app.post('/echoAtTime', (req, res) => {
      const message = ScheduledMessage.parse(req.body);
      message.dateTime.setHours(message.dateTime.getHours() + 1);

      repository.add(message)
        .then(() => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(message));
        });
    });

    app.get('/test_popEarliest', (req, res) => {
      repository.pop(new Date())
        .then((messages) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(messages));
        });
    });

    app.get('/test_handleEarliest', (req, res) => {
      repository.pop(new Date())
        .then((messages) => {
          messages.forEach((message) => {
            console.log(`[ Message ]: ${message}`);
          });

          res.setHeader('Content-Type', 'application/json');
          res.end('{}');
        });
    });

    app.get('/test_stopWatching', (req, res) => {
      stopWatching();

      res.setHeader('Content-Type', 'application/json');
      res.end('{}');
    });

    app.get('/test_startWatching', (req, res) => {
      restartWatching(repository);

      res.setHeader('Content-Type', 'application/json');
      res.end('{}');
    });

    // catch 404 and forward to error handler
    app.use((req, res, next) => {
      next(createError(404));
    });

    // error handler
    app.use((err, req, res) => {
      // set locals, only providing error in development
      res.locals.message = err.message;
      res.locals.error = req.app.get('env') === 'development' ? err : {};

      // render the error page
      res.status(err.status || 500).send({ error: err });
    });

    app.listen(3000, () => { console.log('Started listening'); });
  });

module.exports = app;
