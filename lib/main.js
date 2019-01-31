const provider = require('./provider');

module.exports = {
  config: {
    disableBasicCompletions: {
      type: 'boolean',
      default: false
    }
  },

  activate () { },
  getProvider () { return provider }
}
