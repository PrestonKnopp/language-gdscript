/* Todos
 * - Add support for showing native_symbol definition/datatip.
 *
 *   Godot Language Server sends a custom notification `gdscript/show_native_symbol`
 *   when hyperclicking a native symbol such as String. It responds with the
 *   markdown documentation for that symbol.
 *
 *   When a symbol is hovered the server sends documentation, too.
 *
 *   How do we intercept these notifications with AutoLanguageClient?
 */
const {AutoLanguageClient} = require('atom-languageclient')
const stream = require('stream')
const WebSocket = require('ws')
const EventEmitter = require('events')
const {CompositeDisposable} = require('atom')

const COMM_RECONNECT = 'lang-gdscript:reconnect-to-language-server'

/**
 * Since we are using websockets to connect to the Godot Editor Language Server
 * we don't have a stderr construct. We workaround this be creating an empty
 * readable that does nothing when read from.
 */
class EmptyReadableStream extends stream.Readable {
  _read() {}
}

/**
 * GDScriptLanguageServerProcess connects to the Godot Editor. AutoLanguageClient
 * expects a ChildProcess so this is just a wrapper that implements the minimal
 * interface required.
 */
class GDScriptLanguageServerProcess extends EventEmitter {
  constructor() {
    super()
    // Keep a ref of the created sockets so they can be destroyed when the
    // client asks.
    this.websocket = null
    this.socket = null
    // Read the EmptyReadableStream doc comment to find out my reasoning on why
    // I'm using it.
    this.stderr = new EmptyReadableStream()
    // We don't have a process id.
    this.pid = -1
  }

  // AutoLanguageClient expects a process with a input and output stream.
  // We, however, don't launch a process. The socket we use can both be read
  // from and written to for the LanguageClient's purposes.
  get stdin() { return this.socket }
  get stdout() { return this.socket }

  start(port) {
    return new Promise((resolve, reject) => {

      const onUnexpectedCloseBeforeOpen = (code, reason) => {
        const error = new Error(`GodotClient.ServerProcess.OnUnexpectedCloseBeforeOpen reason:${reason}`)
        error.code = code
        this.emit('close', code, reason)
        reject(error)
      }

      const onUnexpectedErrorBeforeOpen = (error) => {
        const err = new Error(`GodotClient.ServerProcess.OnUnexpectedErrorBeforeOpen error:${error.message}`)
        err.code = error.code
        this.emit('error', err)
        reject(err)
      }

      const onClose = (code, reason) => {
        if (this.socket) {
          // Emit close manually so the underlying client reader/writers can
          // react. It closes automatically, but by that time the client will
          // throw errors.
          this.socket.emit('close', code, reason)
        }
        this.emit('close', code, reason)
        this.emit('exit', code, reason)
      }

      const onError = (error) => {
        this.emit('error', error)
      }

      const onOpen = () => {
        // Create a duplex that client can use for reading and writing.
        this.socket = WebSocket.createWebSocketStream(this.websocket, {
          encoding: 'utf8'
        })

        this.websocket
            .off('close', onUnexpectedCloseBeforeOpen)
            .off('error', onUnexpectedErrorBeforeOpen)
            .on('close', onClose)
            .on('error', onError)

        // Emit open so that our client can save a ref to the socket
        this.emit('open', this.socket)

        resolve(this)
      }

      this.websocket = new WebSocket('ws://localhost:'+port)
          .on('open', onOpen)
          .on('close', onUnexpectedCloseBeforeOpen)
          .on('error', onUnexpectedErrorBeforeOpen)

    })
  }

  kill(signal) {
    console.log('GDScript language server process signal: ', signal)
    if (this.socket) {
      this.socket.destroy()
    }
    if (this.websocket) {
      this.websocket.terminate()
    }
  }

}

/**
 * The GDScriptLanguageClient and Atom Package entry point.
 */
class GDScriptLanguageClient extends AutoLanguageClient {

  constructor() {
    super()
    this.config = {
      godotApplicationBinaryPath: {
        type: 'string',
        default: ''
      },
      godotServerPort: {
        type: 'integer',
        default: 6008,
        description: 'This should match the port set in the Godot Editor Settings'
      }
    }
  }

  getGrammarScopes() { return ['source.gdscript'] }
  getLanguageName() { return 'GDScript' }
  getServerName() { return 'Godot Editor Language Server' }
  getConnectionType() { return 'socket' }

  startServerProcess(_projectPath) {
    const port = atom.config.get('lang-gdscript.godotServerPort', 6008)

    const onOpen = (socket) => {
      this.socket = socket
      this.showConnectedNotification()
    }

    const onClose = (code, reason) => {
      // This seems to fix/prevent a spam of errors from throwing when Godot
      // is closed while we are connected.
      // By doing this, we force the AutoLanguageClient's managed servers to
      // stop listening, so user events won't through the 'Not connected' error.
      super.deactivate()
      this.showDisconnectedNotification()
    }

    const onError = (error) => {
      if (error.code !== 'ECONNREFUSED') {
        return
      }

      this.showDisconnectedNotification()
    }

    return new GDScriptLanguageServerProcess()
        .on('open', onOpen)
        .on('close', onClose)
        .on('error', onError)
        .start(port)
  }

  activate() {

    const onCommandReconnect = (event) => {
      if (this.socket && !this.socket.destroyed && this.socket.readable &&
        this.socket.writable) {
        this.showConnectedNotification()
        return
      }

      // This probably isn't the best way to reconnect, but I can't figure out
      // a reliable way to reset the client to start the process again.
      super.deactivate().then(() => {
        super.activate()
      })
    }

    this.disposables = new CompositeDisposable()
    this.disposables.add(atom.commands.add(
      'atom-workspace', COMM_RECONNECT, onCommandReconnect
    ))
    this.disposables.add(atom.menu.add([{
      label: 'Packages',
      submenu: [{
        label: 'Lang GDScript',
        submenu: [
          {
            label: 'Reconnect to Godot Editor Language Server',
            command: COMM_RECONNECT
          }
        ]
      }]
    }]))
    super.activate()
  }

  deactivate() {
    this.disposables.dispose()
    return super.deactivate()
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
            atom.commands.dispatch(target, COMM_RECONNECT)
            notification.dismiss()
          }
        }
      ]
    })
  }

}

module.exports = new GDScriptLanguageClient()
