const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const commander = require('commander');
const MessageRepository = require('./src/MessageRepository');
const Message = require('./src/Message');
const MessageHandler = require('./src/MessageHandler');
const Database = require('./src/Database');

const DEFAULT_PORT = 3000;

function setupServer() {
  const app = express();

  // view engine setup
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'jade');

  app.use(logger('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, 'public')));

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

  return app;
}

function echoAtTimeHandler(repository) {
  return (req, res) => {
    const message = Message.parse(req.body);
    repository.add(message)
      .then(() => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(message));
      });
  };
}

function testPopEarliestHandler(repository) {
  return (req, res) => {
    repository.pop(new Date())
      .then((messages) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(messages));
      });
  };
}

function testHandleEarliest(repository) {
  return (req, res) => {
    repository.pop(new Date())
      .then((messages) => {
        messages.forEach((message) => {
          console.log(`[ Message ]: ${message}`);
        });

        res.setHeader('Content-Type', 'application/json');
        res.end('{}');
      });
  };
}

function stopMessageHandling(messageHandler) {
  return (req, res) => {
    messageHandler.stop();

    res.setHeader('Content-Type', 'application/json');
    res.end('{}');
  };
}

function startMessageHandling(messageHandler) {
  return (req, res) => {
    messageHandler.restart();

    res.setHeader('Content-Type', 'application/json');
    res.end('{}');
  };
}

commander
  .option('-p, --port <n>', 'Listened port', parseInt)
  .parse(process.argv);

const app = setupServer();

Database.connect('localhost', 6379)
  .then((db) => {
    const repository = new MessageRepository(db);
    const messageHandler = new MessageHandler(repository);
    messageHandler.restart();

    app.post('/echoAtTime', echoAtTimeHandler(repository));

    app.get('/test_popEarliest', testPopEarliestHandler(repository));
    app.get('/test_handleEarliest', testHandleEarliest(repository));
    app.get('/test_stopWatching', stopMessageHandling(messageHandler));
    app.get('/test_startWatching', startMessageHandling(messageHandler));

    const port = commander.port || DEFAULT_PORT;
    app.listen(port, () => {
      console.log(`Started listening on port ${port}`);
    });
  });

module.exports = app;
