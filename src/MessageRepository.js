const redis = require('redis');
const assert = require('./utils/assert');

const DATETIME_SET_NAME = 'dates';
const MESSAGES_LIST_PREFIX = 'messages';

class MessageRepository {
  static connect(host, port) {
    return new Promise((resolve, reject) => {
      const client = redis.createClient(port, host);
      client.on('connect', () => {
        const storage = new MessageRepository(client);
        resolve(storage);
      });
      client.on('error', reject);
    });
  }

  constructor(redisClient) {
    this.client = redisClient;
  }

  add(message) {
    return new Promise((resolve, reject) => {
      const milliseconds = message.dateTime.getTime();

      const transaction = this.client.multi();
      transaction.zadd(
        DATETIME_SET_NAME,
        milliseconds,
        milliseconds,
      );
      transaction.rpush(
        `${MESSAGES_LIST_PREFIX}:${milliseconds}`,
        message.text,
      );
      transaction.exec((error) => {
        if (error) {
          reject(new Error(`Error while saving a message: ${error.message}`));
        } else {
          resolve();
        }
      });
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
      this.client.zrange(DATETIME_SET_NAME, 0, 0, (error, dates) => {
        if (error) {
          reject(new Error(`Error while getting first nearest message datetime: ${error.message}`));
          return;
        }

        if (!dates || dates.length === 0 || dates[0] > maxDateTime.getTime()) {
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

    this.client.watch(listKey);

    return this.getMessages(listKey)
      .then(messages => this.clearMessagesData(timestamp, listKey)
        .then(() => {
          this.client.unwatch(listKey);
          return messages;
        }))
      .catch((error) => {
        this.client.unwatch(listKey);
        throw error;
      });
  }

  getMessages(listKey) {
    return this.getListLength(listKey)
      .then(length => this.getListValues(listKey, length));
  }

  getListLength(listKey) {
    return new Promise((resolve, reject) => {
      this.client.llen(listKey, (error, length) => {
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
      this.client.lrange(listKey, 0, listLength - 1, (error, values) => {
        if (error) {
          reject(new Error(`Error while getting "${listKey}" list values: ${error.message}`));
          return;
        }

        resolve(values);
      });
    });
  }

  clearMessagesData(timestamp, listKey) {
    return new Promise((resolve, reject) => {
      const transaction = this.client.multi();
      transaction.del(listKey);
      // TODO: Check that it is not performed if watched list changed.
      transaction.zremrangebyscore(DATETIME_SET_NAME, timestamp, timestamp);
      transaction.exec((error, resultArray) => {
        if (error) {
          reject(new Error(`Error while clearing message data: ${error.message}`));
        } else if (!resultArray) {
          reject(new Error('Cannot clear message data, cause it was modified by other component'));
        } else {
          resolve();
        }
      });
    });
  }
}

module.exports = MessageRepository;
