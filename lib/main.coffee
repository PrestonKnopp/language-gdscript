provider = require './provider'

module.exports =
  config:
    disableBasicCompletions:
      type: 'boolean'
      default: false
  activate: ->
    provider.loadCompletions() unless atom.config.get('lang-gdscript.disableBasicCompletions')

  getProvider: -> provider
