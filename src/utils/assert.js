module.exports = (condition, message) => {
  if (condition) {
    return;
  }

  debugger;

  let errorMessage = '[ Assertion Error ]';
  if (message) {
    errorMessage += `: ${message}`;
  }

  throw new Error(errorMessage);
};
