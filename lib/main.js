const {CompositeDisposable, Disposable} = require('atom')
const BasicCompletionProvider = require('./basic-completion-provider')
const GDScriptLanguageClient = require('./gdscript-ls-client')

const packageName = 'lang-gdscript'
const keyUseGodotLS = 'useGodotLanguageServer'
const keyGodotLSPort = 'godotLanguageServerPort'
const commConnect = formPackageCommand('connect-to-language-server')

function formPackageCommand(command) {
  return packageName + ':' + command
}

function formPackageConfigKeyPath(key) {
  return packageName + '.' + key
}

class ConsumerProviderForwarder {

  constructor() {
    this._consumerProvider = null
    this._consumerServices = {}

    // We can forward consumer methods here
    // since we consume an object that can be
    // cached rather than having to return a
    // config object.
    const consumerCallbackNames = [
      'consumeDatatip',
      'consumeConsole',
      'consumeLinterV2',
      'consumeBusySignal',
      'consumeSignatureHelp'
    ]
    for (let callbackName of consumerCallbackNames) {
      this[callbackName] = (service) => this._forwardConsume(callbackName, service)
    }
  }

  getGrammarScopes() { throw 'Must Override' }
  getName() { throw 'Must Override' }

  getConsumerProvider() {
    return this._consumerProvider
  }

  setConsumerProvider(consumerProvider) {
    this._consumerProvider = consumerProvider
    if (!this._consumerProvider) return
    for (let consumeName in this._consumerServices) {
      const service = this._consumerServices[consumeName]
      const consume = this._consumerProvider[consumeName]
      if (!consume) continue
      consume.call(this._consumerProvider, service)
    }
  }

  _forwardProviderCall(providerCallName) {
    return (...providerArgs) => {
      const provider = this._consumerProvider
      if (!provider) return null
      const provide = provider[providerCallName]
      if (!provide) return null
      return provide.apply(provider, providerArgs)
    }
  }

  _forwardConsume(consumeName, service) {
    this._consumerServices[consumeName] = service
    const consumer = this._consumerProvider
    if (!consumer) return
    const consume = consumer[consumeName]
    if (!consume) return
    consume.call(consumer, service)
  }

  // Providers need a proxy object.
  provideAutocomplete() {
    return {
      selector: this.getGrammarScopes()
        .map((g) => g.includes('.') ? '.' + g : g)
        .join(', '),
      inclusionPriority: 1,
      suggestionPriority: 2,
      excludeLowerPriority: false,
      getSuggestions: this._forwardProviderCall('getSuggestions'),
      onDidInsertSuggestion: this._forwardProviderCall('onDidInsertSuggestion'),
      getSuggestionDetailsOnSelect: this._forwardProviderCall('getSuggestionDetailsOnSelect')
    }
  }

  provideDefinitions() {
    return {
        name: this.getName(),
        priority: 20,
        grammarScopes: this.getGrammarScopes(),
        getDefinition: this._forwardProviderCall('getDefinition')
    }
  }

  provideOutlines() {
    return {
        name: this.getName(),
        grammarScopes: this.getGrammarScopes(),
        priority: 1,
        getOutline: this._forwardProviderCall('getOutline')
    }
  }

  provideFindReferences() {
    return {
        isEditorSupported: (editor) => this.getGrammarScopes().includes(editor.getGrammar().scopeName),
        findReferences: this._forwardProviderCall('getReferences')
    };
  }

  provideCodeHighlight() {
    return {
        grammarScopes: this.getGrammarScopes(),
        priority: 1,
        highlight: this._forwardProviderCall('getCodeHighlight')
    }
  }

  provideCodeActions() {
    return {
        grammarScopes: this.getGrammarScopes(),
        priority: 1,
        getCodeActions: this._forwardProviderCall('getCodeActions')
    };
  }

  // Consumptions are forwarded in the constructor.
  consumeDatatip(service) {}
  consumeConsole(service) {}
  consumeLinterV2(service) {}
  consumeBusySignal(service) {}
  consumeSignatureHelp(service) {}
}

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
      'atom-workspace', commConnect, this.activateLanguageClient.bind(this)
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
          this.destroyBasicCompletionProvider()
          this.activateLanguageClient()
        } else {
          this.destroyLanguageClient()
          this.activateBasicCompletionProvider()
        }
      }
    ))

    this.disposable.add(new Disposable(() => {
      this.destroyLanguageClient()
    }))

    this.disposable.add(new Disposable(() => {
      this.destroyBasicCompletionProvider()
    }))

  }

  activateBasicCompletionProvider() {
    if (!this._basicCompletionProvider) {
      this._basicCompletionProvider = new BasicCompletionProvider()
      this._basicCompletionProvider.loadCompletions()
    }

    this.setConsumerProvider(this._basicCompletionProvider)
  }

  deactivateBasicCompletionProvider() {
    if (this._basicCompletionProvider) {
      this._basicCompletionProvider.clearCompletions()
    }
  }

  destroyBasicCompletionProvider() {
    this.deactivateBasicCompletionProvider()
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

  deactivateLanguageClient() {
    if (this._languageClient) this._languageClient.deactivate()
  }

  destroyLanguageClient() {
    this.deactivateLanguageClient()
    this._languageClient = null
  }

  deactivate() {
    this.disposable.dispose()
  }

  showConnectedNotification() {
    const note = 'Connected to ' + this.getServerName()
    const notification = atom.notifications.addSuccess(note, {
      dismissable: true
    })
    setTimeout(() => {
      notification.dismiss()
    }, 1500)
  }

  showDisconnectedNotification() {
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
        }
      ]
    })
  }
}

module.exports = new AtomPackageMain();
