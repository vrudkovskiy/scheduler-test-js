const redis = require('redis');

class Database {
  static connect(host, port) {
    return new Promise((resolve, reject) => {
      const client = redis.createClient(port, host);
      client.on('connect', () => {
        const db = new Database(client);
        resolve(db);
      });
      client.on('error', reject);
    });
  }

  constructor(redisClient) {
    this.client = redisClient;
  }

  transaction(callback) {
    return new Promise((resolve, reject) => {
      const transaction = this.client.multi();
      callback(transaction);
      transaction.exec((error, resultArray) => {
        if (error) {
          reject(error);
        } else if (!resultArray) {
          reject(new Error('Transaction failed'));
        } else {
          resolve();
        }
      });
    });
  }
}

module.exports = Database;
