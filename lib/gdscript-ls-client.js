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
const datatipAdapterPatch = require('./datatip-adapter-patch')

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

      const onClose = (code, reason) => {
        this.kill(code)

        // Emit disconnected only so we can react to it.
        this.emit('disconnected')
      }

      const onError = (error) => {
        reject(error)
        this.emit('error', error)
      }

      const onOpen = () => {
        // Create a duplex that client can use for reading and writing.
        this.socket = WebSocket.createWebSocketStream(this.websocket)

        // Emit connected so that our client can save a ref to the socket which
        // is required as AutoLanguageClient.createRpcConnection() uses the
        // socket immediately after this promise resolves.
        this.emit('connected', this.socket)
        resolve(this)
      }

      this.websocket = new WebSocket('ws://localhost:'+port)
      this.websocket.on('open', onOpen)
      this.websocket.on('error', onError)
      this.websocket.on('close', onClose)
    })
  }

  kill(signal) {
    if (this.socket) {
      this.socket.destroy()
    }
    if (this.websocket) {
      this.websocket.terminate()
    }

    this.websocket = null
    this.socket = null
  }

}

module.exports = class GDScriptLanguageClient extends AutoLanguageClient {

  constructor() {
    super()
    this.myGrammarScopes = []
    this.port = null
    this._connectionEmitter = new EventEmitter()

    this._hasPatchedDatatipAdapter = false
  }

  getGrammarScopes() { return this.myGrammarScopes }
  getLanguageName() { return 'GDScript' }
  getServerName() { return 'Godot Editor Language Server' }
  getConnectionType() { return 'socket' }

  preInitialization(clientConnection) {
    // Godot will and should throw an error on `shutdown` requests. So, let's
    // overwrite it to do nothing.
    clientConnection.shutdown = () => {}
  }

  getDatatip(editor, point) {
    if (this.datatip && !this._hasPatchedDatatipAdapter) {
      datatipAdapterPatch(this.datatip)
      this._hasPatchedDatatipAdapter = true
    }

    return super.getDatatip(editor, point)
  }

  startServerProcess(_projectPath) {
    const port = this.port || DEFAULT_PORT

    const onConnected = (socket) => {
      // Save socket for AutoLanguageClient.createRpcConnection().
      this.socket = socket
      this._connectionEmitter.emit('connected')
    }

    const onDisconnected = () => {
      this._connectionEmitter.emit('disconnected')
    }

    return new GDScriptLanguageServerProcess()
        .on('connected', onConnected)
        .on('disconnected', onDisconnected)
        .start(port)
  }

  onConnected(callback) { this._connectionEmitter.on('connected', callback) }
  onDisconnected(callback) { this._connectionEmitter.on('disconnected', callback)}

  isConnected() {
    return (this.socket &&
      !this.socket.destroyed &&
      this.socket.readable &&
      this.socket.writable)
  }

}
