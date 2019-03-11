const assert = require('./utils/assert');

class Message {
  static parse(json) {
    assert((json instanceof Object) || (json instanceof String));

    const jsonObj = (json instanceof Object)
      ? json
      : JSON.parse(json);

    const date = new Date(jsonObj.dateTime);
    return new Message(date, jsonObj.text);
  }

  constructor(dateTime, text) {
    assert(dateTime instanceof Date);
    assert(typeof text === 'string');
    assert(text.length > 0);

    this.dateTime = dateTime;
    this.text = text;
  }
}

module.exports = Message;
