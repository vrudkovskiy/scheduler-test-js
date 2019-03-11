const assert = require('./utils/assert');

const DATETIME_SET_NAME = 'dates';
const MESSAGES_LIST_PREFIX = 'messages';

class MessageRepository {
  constructor(db) {
    this.db = db;
  }

  add(message) {
    const milliseconds = message.dateTime.getTime();

    return this.db.transaction((transaction) => {
      transaction.zadd(
        DATETIME_SET_NAME,
        milliseconds,
        milliseconds,
      );
      transaction.rpush(
        `${MESSAGES_LIST_PREFIX}:${milliseconds}`,
        message.text,
      );
    })
      .catch((error) => {
        throw new Error(`Error while saving a message: ${error.message}`);
      });
  }

  pop(maxDateTime) {
    return this.getEarliestDateTime(maxDateTime)
      .then((earliestDateTime) => {
        if (!earliestDateTime) {
          return [];
        }

        return this.popEarliestMessages(earliestDateTime);
      });
  }

  getEarliestDateTime(maxDateTime) {
    assert(maxDateTime instanceof Date);

    return new Promise((resolve, reject) => {
      this.db.client.zrange(DATETIME_SET_NAME, 0, 0, (error, dates) => {
        if (error) {
          reject(new Error(`Error while getting first nearest message datetime: ${error.message}`));
          return;
        }

        if (!dates || dates.length === 0 || Number(dates[0]) > maxDateTime.getTime()) {
          resolve(null);
          return;
        }

        resolve(new Date(Number(dates[0])));
      });
    });
  }

  popEarliestMessages(earliestDateTime) {
    assert(earliestDateTime instanceof Date);

    const timestamp = earliestDateTime.getTime();
    const listKey = `${MESSAGES_LIST_PREFIX}:${timestamp}`;

    this.db.client.watch(listKey);

    return this.getMessages(listKey)
      .then(messages => this.clearMessagesData(timestamp, listKey)
        .then(() => {
          this.db.client.unwatch(listKey);
          return messages;
        }))
      .catch((error) => {
        this.db.client.unwatch(listKey);
        throw error;
      });
  }

  getMessages(listKey) {
    return this.getListLength(listKey)
      .then(length => this.getListValues(listKey, length));
  }

  getListLength(listKey) {
    return new Promise((resolve, reject) => {
      this.db.client.llen(listKey, (error, length) => {
        if (error) {
          reject(new Error(`Error while getting "${listKey}" list length: ${error.message}`));
          return;
        }

        resolve(length);
      });
    });
  }

  getListValues(listKey, listLength) {
    return new Promise((resolve, reject) => {
      this.db.client.lrange(listKey, 0, listLength - 1, (error, values) => {
        if (error) {
          reject(new Error(`Error while getting "${listKey}" list values: ${error.message}`));
          return;
        }

        resolve(values);
      });
    });
  }

  clearMessagesData(timestamp, listKey) {
    return this.db.transaction((transaction) => {
      transaction.del(listKey);
      // TODO: Check that it is not performed if watched list changed.
      transaction.zremrangebyscore(DATETIME_SET_NAME, timestamp, timestamp);
    })
      .catch((error) => {
        throw new Error(`Error while clearing message data: ${error.message}`);
      });
  }
}

module.exports = MessageRepository;
