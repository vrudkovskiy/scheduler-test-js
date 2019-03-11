const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const commander = require('commander');
const MessageRepository = require('./src/MessageRepository');
const Message = require('./src/Message');
const MessageHandler = require('./src/MessageHandler');

const DEFAULT_PORT = 3000;

commander
  .option('-p, --port <n>', 'Listened port', parseInt)
  .parse(process.argv);

const app = express();

MessageRepository.connect('localhost', 6379)
  .then((repository) => {
    const messageHandler = new MessageHandler(repository);
    messageHandler.restart();

    // view engine setup
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'jade');

    app.use(logger('dev'));
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, 'public')));

    app.post('/echoAtTime', (req, res) => {
      const message = Message.parse(req.body);
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
      messageHandler.stop();

      res.setHeader('Content-Type', 'application/json');
      res.end('{}');
    });

    app.get('/test_startWatching', (req, res) => {
      messageHandler.restart();

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

    const port = commander.port || DEFAULT_PORT;
    app.listen(port, () => {
      console.log(`Started listening on port ${port}`);
    });
  });

module.exports = app;
