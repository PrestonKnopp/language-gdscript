const {AutoLanguageClient} = require('atom-languageclient')
const stream = require('stream')
const EventEmitter = require('events')
const {CompositeDisposable, Disposable} = require('atom')
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

EmptyReadableStream.instance = new EmptyReadableStream();

/**
 * GDScriptLanguageServerProcess connects to the Godot Editor. AutoLanguageClient
 * expects a ChildProcess so this is just a wrapper that implements the minimal
 * interface required.
 */
class GDScriptLanguageServerProcess extends EventEmitter {
  constructor() {
    super()
    // Keep a ref of the created sockets so they can be destroyed when the
    // client asks
    this.socket = null
    // We don't have a process id.
    this.pid = -1
    // Keep it clean.
    this.disposable = new CompositeDisposable()
  }

  // AutoLanguageClient expects a process with a input and output stream.
  // We, however, don't launch a process. The socket we use can both be read
  // from and written to for the LanguageClient's purposes.
  get stdin() { return this.socket }
  get stdout() { return this.socket }
  get stderr() { return EmptyReadableStream.instance }

  // override
  _start(port, onOpen, onError, onClose) {}

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
        // Emit connected so that our client can save a ref to the socket which
        // is required as AutoLanguageClient.createRpcConnection() uses the
        // socket immediately after this promise resolves.
        this.emit('connected', this.socket)
        resolve(this)
      }

      this.disposable.add(new Disposable(() => {
        if (this.socket) {
          this.socket.destroy()
          this.socket = null
        }
      }))

      this._start(port, onOpen, onError, onClose);
    })
  }

  kill(signal) {
    this.disposable.dispose()
  }

}

class WsLsProcess extends GDScriptLanguageServerProcess {
  _start(port, onOpen, onError, onClose) {
    const WebSocket = require('ws')
    const webSocket = new WebSocket('ws://localhost:'+port)
    webSocket
      .on('error', onError)
      .on('close', onClose)
      .on('open', () => {
        // Create a duplex that client can use for reading and writing.
        this.socket = WebSocket.createWebSocketStream(webSocket)
        onOpen()
      })
    this.disposable.add(new Disposable(() => {
      if (webSocket) {
        webSocket.terminate()
      }
    }))
  }
}

class TcpLsProcess extends GDScriptLanguageServerProcess {
  _start(port, onOpen, onError, onClose) {
    const net = require('net')
    this.socket = new net.Socket();
    this.socket.connect(port);
    this.socket
      .on('connect', onOpen)
      .on('error', onError)
      .on('close', onClose)
  }
}

module.exports = class GDScriptLanguageClient extends AutoLanguageClient {

  constructor() {
    super()
    this.myGrammarScopes = []
    this.port = null
    this.useWebSockets = false
    this._connectionEmitter = new EventEmitter()
    this._languageServerProcess = null

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

    if (this._languageServerProcess && this.isConnected()) {
      return this._languageServerProcess
    }

    if (this.useWebSockets) {
      this._languageServerProcess = new WsLsProcess()
    } else {
      this._languageServerProcess = new TcpLsProcess()
    }

    return this._languageServerProcess
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
