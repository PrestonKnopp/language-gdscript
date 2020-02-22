const {CompositeDisposable, Disposable} = require('atom')
const BasicCompletionProvider = require('./basic-completion-provider')
const GDScriptLanguageClient = require('./gdscript-ls-client')
const ConsumerProviderForwarder = require('./consumer-provider-forwarder')

const packageName = 'lang-gdscript'

const keyGodotLSPort = 'godotLanguageServerPort'

const commConnect = formPackageCommand('connect-to-language-server')
const commShowStatus = formPackageCommand('show-language-client-status')

function formPackageCommand(command) { return `${packageName}:${command}` }
function formPackageConfigKeyPath(key) { return `${packageName}.${key}` }


// -----------------------------------------------------------------------------
// -                                 Package Main                              -
// -----------------------------------------------------------------------------


class AtomPackageMain extends ConsumerProviderForwarder {
  constructor() {
    super()

    this.config = {
      [keyGodotLSPort]: {
        type: 'integer',
        default: 6008,
        description: 'This should match the port set in the Godot (v3.2+) Editor Settings'
      }
    }

    this.disposable = new CompositeDisposable()
    this._languageClient = null
    this._basicCompletionProvider = null
  }

  getGrammarScopes() { return ['source.gdscript'] }
  getName() { return 'GDScript' }
  getServerName() { return 'Godot Editor Language Server' }

  activate() {

    this.activateLanguageClient()

    this.disposable.add(atom.commands.add(
      'atom-workspace',
      commConnect,
      this.activateLanguageClient.bind(this)
    ))

    this.disposable.add(atom.commands.add(
      'atom-workspace',
      commShowStatus,
      this.showStatus.bind(this)
    ))

    this.disposable.add(atom.menu.add([{
      label: 'Packages',
      submenu: [{
        label: 'Lang GDScript',
        submenu: [
          {
            label: 'Connect to Godot Editor Language Server',
            command: commConnect
          },
          {
            label: 'Show Language Client Status',
            command: commShowStatus
          }
        ]
      }]
    }]))

    this.disposable.add(new Disposable(this.disposeLanguageClient.bind(this)))
    this.disposable.add(new Disposable(this.disposeBasicCompletionProvider.bind(this)))
  }

  deactivate() {
    this.disposable.dispose()
  }

  activateBasicCompletionProvider() {
    if (!this._basicCompletionProvider) {
      this._basicCompletionProvider = new BasicCompletionProvider()
      this._basicCompletionProvider.loadCompletions()
    }

    this.setConsumerProvider(this._basicCompletionProvider)
  }

  disposeBasicCompletionProvider() {
    if (this._basicCompletionProvider) {
      this._basicCompletionProvider.clearCompletions()
    }
    this._basicCompletionProvider = null
  }

  activateLanguageClient() {
    if (this._languageClient) {
      if (this._languageClient.isConnected()) {
        this.showConnectedNotification()
        return
      }

      this._languageClient.deactivate().then(() => {
        this._languageClient.activate()
      })
    } else {
      this._languageClient = new GDScriptLanguageClient()
      this._languageClient.myGrammarScopes = this.getGrammarScopes()
      this._languageClient.port = atom.config.get(formPackageConfigKeyPath(keyGodotLSPort))
      this._languageClient.activate();
      this.setConsumerProvider(this._languageClient)
    }
  }

  disposeLanguageClient() {
    if (this._languageClient) {
      this._languageClient.deactivate()
    }
    this._languageClient = null
  }

  showStatus() {
    let info = []
    if (this._languageClient && this._languageClient.isConnected()) {
      info.push('You are **connected** to the Godot Language Server.')
      info.push('Are you not getting results in a file?')
      info.push('Try closing and reopening that file\'s tabs.')
    } else {
      info.push('You are **not connected** to the Godot Language Server.')
      if (this._basicCompletionProvider) {
        info.push('You are **using** the basic completion provider.')
      }
      info.push('Are you trying to reconnect?')
      info.push('Try opening or reopening a gdscript file.')
      info.push('Make sure the Godot LS `port` is the same as in the package settings.')
    }
    atom.notifications.addInfo(info.join(' '), { dismissable: true })
  }

}

module.exports = new AtomPackageMain();
