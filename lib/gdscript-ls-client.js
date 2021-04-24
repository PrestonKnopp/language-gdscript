const {AutoLanguageClient} = require('atom-languageclient')
const stream = require('stream')
const EventEmitter = require('events')
const {CompositeDisposable, Disposable} = require('atom')
const datatipAdapterPatch = require('./datatip-adapter-patch')

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

      const onClose = (code, reason) => {}
      const onOpen = () => { resolve(this) }
      const onError = (error) => {
        reject(error)
        this.emit('error', error)
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

    this._languageServerProcess = null
    this._hasPatchedDatatipAdapter = false
  }

  // This is required as AutoLanguageClient.createRpcConnection() accesses
  // `this.socket`, where `this` is the language client, immediately after the
  // startServerProcess() promise resolves.
  get socket() {
    if (this._languageServerProcess) {
      return this._languageServerProcess.socket
    }
    return null
  }

  preInitialization(clientConnection) {
    // Godot will and should throw an error on `shutdown` requests. So, let's
    // overwrite it to do nothing.
    clientConnection.shutdown = () => {}
    // We recieve error responses when sending the textDocument/didClose notification:
    // "Received response message without id: Error is: {"code": -32601, "message": "Method not found: didClose"}"
    clientConnection.didCloseTextDocument = (_) => {}
  }

  getDatatip(editor, point) {
    if (this.datatip && !this._hasPatchedDatatipAdapter) {
      datatipAdapterPatch(this.datatip)
      this._hasPatchedDatatipAdapter = true
    }

    return super.getDatatip(editor, point)
  }

  startServerProcess(_projectPath) {
    if (this.isConnected()) {
      return this._languageServerProcess
    }

    if (this.getUseWebSockets()) {
      this._languageServerProcess = new WsLsProcess()
    } else {
      this._languageServerProcess = new TcpLsProcess()
    }

    return this._languageServerProcess.start(this.getPort())
  }

  isConnected() {
    return (this.socket &&
      !this.socket.destroyed &&
      this.socket.readable &&
      this.socket.writable)
  }

}
