const {CompositeDisposable, Disposable} = require('atom')
const GDScriptLanguageClient = require('./gdscript-ls-client')

const packageName = 'lang-gdscript'

const keyUseWebSockets = 'useWebSockets'
const keyGodotLsPort = 'godotLanguageServerPort'
const keyEnableLsc = 'enableGodotLanguageServerClient'

const keyPathUseWebSockets = `${packageName}.${keyUseWebSockets}`
const keyPathGodotLsPort = `${packageName}.${keyGodotLsPort}`
const keyPathEnableLsc = `${packageName}.${keyEnableLsc}`

const commShowStatus = `${packageName}:show-language-client-status`

const defaultPort = 6008
const defaultUseWebSockets = false
const defaultEnableLsc = true


// -----------------------------------------------------------------------------
// -                                 Package Main                              -
// -----------------------------------------------------------------------------


class AtomPackageMain extends GDScriptLanguageClient {

  constructor() {
    super()

    this.config = {
      [keyEnableLsc]: {
        type: 'boolean',
        default: defaultEnableLsc,
        description: '(Reload required) Enable the auto-connecting client for the Godot Language Server to get rich autocompletion. Install the atom-ide-base package to get rendered markdown documentation datatips, jump-to-definition, linting, and a symbol outline panel.'
      },
      [keyGodotLsPort]: {
        type: 'integer',
        default: defaultPort,
        description: '(Reload required) This should match the port set in the Godot (v3.2+) Editor Settings.'
      },
      [keyUseWebSockets]: {
        type: 'boolean',
        default: defaultUseWebSockets,
        description: '(Reload required) Godot v3.2.2 switches LS protocol from WebSockets to TCP. Enable this only if you are using v3.2 or v3.2.1.'
      }
    }

  }

  getGrammarScopes() { return ['source.gdscript'] }
  getLanguageName() { return 'GDScript' }
  getServerName() { return 'Godot Editor Language Server' }
  getConnectionType() { return 'socket' }
  getPort() { return atom.config.get(keyPathGodotLsPort) }
  getUseWebSockets() { return atom.config.get(keyPathUseWebSockets) }

  shouldStartForEditor(editor) {
    if (atom.config.get(keyPathEnableLsc)) {
      return super.shouldStartForEditor(editor)
    }
    return false
  }

  activate() {

    super.activate()

    this.subscriptions = new CompositeDisposable()

    this.subscriptions.add(atom.commands.add(
      'atom-workspace',
      commShowStatus,
      this.showStatus.bind(this)
    ))

    this.subscriptions.add(atom.menu.add([{
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

  }

  deactivate() {
    this.subscriptions.dispose()
    super.deactivate()
  }

  showStatus() {
    let info = []
    if (!atom.config.get(keyPathEnableLsc)) {
      info.push('The Godot Language Server Client is **disabled**.')
      if (this.isConnected()) {
        info.push('However, the client is still **active and connected** to the server.')
        info.push('Reload atom with the "Window: Reload" command from the command palette.')
      }
    } else if (this.isConnected()) {
      info.push('You are **connected** to the Godot Language Server.')
      info.push('Are you not getting results in a file?')
      info.push('Try closing and reopening that file\'s tabs.')
    } else {
      info.push('You are **not connected** to the **Godot Language Server**.')
      info.push('Are you trying to reconnect?')
      info.push('Try opening or reopening a gdscript file.')
      info.push('Make sure the Godot LS `port` is the same as in the package settings.')
    }
    atom.notifications.addInfo(info.join(' '), { dismissable: true })
  }

}

module.exports = new AtomPackageMain();
