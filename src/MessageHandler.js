
const WATCH_INTERVAL_MS = 1000;

class MessageHandler {
  constructor(messageRepository) {
    this.messageRepository = messageRepository;
    this.watchInterval = null;
  }

  restart() {
    this.stop();

    this.watchInterval = setInterval(() => {
      this.processMessages();
    }, WATCH_INTERVAL_MS);
  }

  stop() {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
    }
  }

  processMessages() {
    return this.messageRepository.pop(new Date())
      .then((messages) => {
        if (messages.length === 0) {
          return Promise.resolve();
        }

        messages.forEach((message) => {
          console.log(`[ Message ]: ${message}`);
        });

        return this.processMessages();
      });
  }
}

module.exports = MessageHandler;
