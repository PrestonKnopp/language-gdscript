const {CompositeDisposable, Disposable} = require('atom')
const BasicCompletionProvider = require('./basic-completion-provider')
const GDScriptLanguageClient = require('./gdscript-ls-client')
const ConsumerProviderForwarder = require('./consumer-provider-forwarder')

const packageName = 'lang-gdscript'

const keyUseGodotLS = 'useGodotLanguageServer'
const keyGodotLSPort = 'godotLanguageServerPort'
const keyShowDisconnectedNote = 'showDisconnectedNotification'

const commConnect = formPackageCommand('connect-to-language-server')

function formPackageCommand(command) { return `${packageName}:${command}` }
function formPackageConfigKeyPath(key) { return `${packageName}.${key}` }


// -----------------------------------------------------------------------------
// -                                 Package Main                              -
// -----------------------------------------------------------------------------


class AtomPackageMain extends ConsumerProviderForwarder {
  constructor() {
    super()

    this.config = {
      [keyUseGodotLS]: {
        type: 'boolean',
        default: false,
        description: 'Use the builtin Godot (v3.2+) Language Server'
      },
      [keyGodotLSPort]: {
        type: 'integer',
        default: 6008,
        description: 'This should match the port set in the Godot (v3.2+) Editor Settings'
      },
      [keyShowDisconnectedNote]: {
        type: 'boolean',
        default: true,
        description: 'Show notification when Godot disconnects or lang-gdscript fails to connect.'
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

    this.disposable.add(atom.commands.add(
      'atom-workspace',
      commConnect,
      this.activateLanguageClient.bind(this)
    ))

    this.disposable.add(atom.menu.add([{
      label: 'Packages',
      submenu: [{
        label: 'Lang GDScript',
        submenu: [
          {
            label: 'Connect to Godot Editor Language Server',
            command: commConnect
          }
        ]
      }]
    }]))

    this.disposable.add(atom.config.observe(
      formPackageConfigKeyPath(keyUseGodotLS),
      (value) => {
        if (value) {
          this.disposeBasicCompletionProvider()
          this.activateLanguageClient()
        } else {
          this.disposeLanguageClient()
          this.activateBasicCompletionProvider()
        }
      }
    ))

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
      this._languageClient.onConnected = this.showConnectedNotification.bind(this)
      this._languageClient.onDisconnected = this.showDisconnectedNotification.bind(this)
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

  showConnectedNotification() {
    const note = 'Connected to ' + this.getServerName()
    const notification = atom.notifications.addSuccess(note, {
      dismissable: true
    })

    setTimeout(() => notification.dismiss(), 1500)
  }

  showDisconnectedNotification() {
    if (!atom.config.get(formPackageConfigKeyPath(keyShowDisconnectedNote))) {
      return
    }

    const note = 'Failed to connect to ' + this.getServerName()
    const notification = atom.notifications.addInfo(note, {
      dismissable: true,
      description: 'The connection failed because the port is busy or Godot editor (version 3.2+) has not been started. You can try reconnecting later from the command pallete or from the Packages > Lang GDScript menu.',
      buttons: [
        {
          text: 'Retry',
          onDidClick() {
            const target = atom.views.getView(atom.workspace)
            atom.commands.dispatch(target, commConnect)
            notification.dismiss()
          }
        },
        {
          text: "Don't show again",
          onDidClick() {
            atom.config.set(formPackageConfigKeyPath(keyShowDisconnectedNote), false)
            notification.dismiss()
          }
        }
      ]
    })
  }
}

module.exports = new AtomPackageMain();
