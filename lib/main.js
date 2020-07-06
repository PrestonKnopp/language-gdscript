const {CompositeDisposable, Disposable} = require('atom')
const BasicCompletionProvider = require('./basic-completion-provider')
const GDScriptLanguageClient = require('./gdscript-ls-client')
const ConsumerProviderForwarder = require('./consumer-provider-forwarder')

const packageName = 'lang-gdscript'

const keyUseWebSockets = 'useWebSockets'
const keyGodotLsPort = 'godotLanguageServerPort'

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
      [keyGodotLsPort]: {
        type: 'integer',
        default: 6008,
        description: 'This should match the port set in the Godot (v3.2+) Editor Settings.'
      },
      [keyUseWebSockets]: {
        type: 'boolean',
        default: false,
        description: 'Godot v3.2.2 switches LS protocol from WebSockets to TCP. Enable this only if you are using v3.2 or v3.2.1.'
      }
    }

    this.disposable = new CompositeDisposable()
    this._client = null
  }

  getGrammarScopes() { return ['source.gdscript'] }
  getName() { return 'GDScript' }
  getServerName() { return 'Godot Editor Language Server' }

  activate() {

    this.activateLanguageClient()

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
    const provider = new BasicCompletionProvider()
    provider.loadCompletions()
    this.setConsumerProvider(provider)
  }

  disposeBasicCompletionProvider() {
    if (this.getConsumerProvider() instanceof BasicCompletionProvider) {
      this.getConsumerProvider().clearCompletions()
    }
    this.setConsumerProvider(null)
  }

  activateLanguageClient() {
    if (!this._client) {
      this._client = new GDScriptLanguageClient()
      this._client.myGrammarScopes = this.getGrammarScopes()
      this._client.port = atom.config.get(formPackageConfigKeyPath(keyGodotLsPort))
      this._client.useWebSockets = atom.config.get(formPackageConfigKeyPath(keyUseWebSockets))
      this._client.onConnected(this.handleLanguageClientConnected.bind(this))
      this._client.onDisconnected(this.handleLanguageClientDisconnected.bind(this))
      this._client.activate()
    }
    this.setConsumerProvider(this._client)
  }

  disposeLanguageClient() {
    if (this._client) {
      this._client.deactivate()
      this._client = null
    }
  }

  handleLanguageClientConnected() {
    this.disposeBasicCompletionProvider()
    this.activateLanguageClient()
  }

  handleLanguageClientDisconnected() {
    // Don't dispose of language client.
    this.activateBasicCompletionProvider()
  }

  showStatus() {
    let c = this.getConsumerProvider()
    let info = []
    if (c instanceof GDScriptLanguageClient && c.isConnected()) {
      info.push('You are **connected** to the Godot Language Server.')
      info.push('Are you not getting results in a file?')
      info.push('Try closing and reopening that file\'s tabs.')
    } else {
      info.push('You are **not connected** to the Godot Language Server.')
      if (c instanceof BasicCompletionProvider) {
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
