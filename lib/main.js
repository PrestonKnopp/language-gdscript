const provider = require('./provider')

module.exports = {
  config: {
    disableBasicCompletions: {
      type: 'boolean',
      default: false
    }
  },

  activate () { return },
  getProvider () { return provider }
}
