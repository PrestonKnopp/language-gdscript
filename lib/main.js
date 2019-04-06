const provider = require('./provider');

module.exports = {
  config: {
    disableBasicCompletions: {
      type: 'boolean',
      default: false
    }
  },

  activate () {
    const d = require('../data/documentation.json')
    provider._project.initDocumentation(d)
  },
  getProvider () { return provider }
}
