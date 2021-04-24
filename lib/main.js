const {CompositeDisposable, Disposable} = require('atom')
const GDScriptLanguageClient = require('./gdscript-ls-client')

const packageName = 'lang-gdscript'

const keyUseWebSockets = 'useWebSockets'
const keyGodotLsPort = 'godotLanguageServerPort'

const keyPathUseWebSockets = `${packageName}.${keyUseWebSockets}`
const keyPathGodotLsPort = `${packageName}.${keyGodotLsPort}`

const commShowStatus = `${packageName}:show-language-client-status`

const defaultPort = 6008
const defaultUseWebSockets = false


// -----------------------------------------------------------------------------
// -                                 Package Main                              -
// -----------------------------------------------------------------------------


class AtomPackageMain extends GDScriptLanguageClient {

  constructor() {
    super()

    this.config = {
      [keyGodotLsPort]: {
        type: 'integer',
        default: defaultPort,
        description: 'This should match the port set in the Godot (v3.2+) Editor Settings.'
      },
      [keyUseWebSockets]: {
        type: 'boolean',
        default: defaultUseWebSockets,
        description: 'Godot v3.2.2 switches LS protocol from WebSockets to TCP. Enable this only if you are using v3.2 or v3.2.1.'
      }
    }

  }

  getGrammarScopes() { return ['source.gdscript'] }
  getLanguageName() { return 'GDScript' }
  getServerName() { return 'Godot Editor Language Server' }
  getConnectionType() { return 'socket' }
  getPort() { return atom.config.get(keyPathGodotLsPort) }
  getUseWebSockets() { return atom.config.get(keyPathUseWebSockets) }

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
    if (this.isConnected()) {
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
