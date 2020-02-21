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

const DEFAULT_PORT = 6008

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

module.exports = class GDScriptLanguageClient extends AutoLanguageClient {

  constructor() {
    super()

    this.myGrammarScopes = []

    this.port = null
    this.onConnected = () => {}
    this.onDisconnected = () => {}
  }

  getGrammarScopes() { return this.myGrammarScopes }
  getLanguageName() { return 'GDScript' }
  getServerName() { return 'Godot Editor Language Server' }
  getConnectionType() { return 'socket' }

  startServerProcess(_projectPath) {
    const port = this.port || DEFAULT_PORT

    const onOpen = (socket) => {
      this.socket = socket
      this.onConnected()
    }

    const onClose = (code, reason) => {
      // This seems to fix/prevent a spam of errors from throwing when Godot
      // is closed while we are connected.
      // By doing this, we force the AutoLanguageClient's managed servers to
      // stop listening, so user events won't through the 'Not connected' error.
      super.deactivate()
      this.onDisconnected()
    }

    const onError = (error) => {
      if (error.code !== 'ECONNREFUSED') {
        return
      }

      this.onDisconnected()
    }

    return new GDScriptLanguageServerProcess()
        .on('open', onOpen)
        .on('close', onClose)
        .on('error', onError)
        .start(port)
  }

  isConnected() {
    return (this.socket &&
      !this.socket.destroyed &&
      this.socket.readable &&
      this.socket.writable)
  }

}
