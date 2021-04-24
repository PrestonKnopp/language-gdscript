const {CompositeDisposable, Disposable} = require('atom')
const {AutoLanguageClient} = require('atom-languageclient')
const {Readable} = require('stream')
const EventEmitter = require('events')

/**
 * Since we are using websockets to connect to the Godot Editor Language Server
 * we don't have a stderr construct. We workaround this be creating an empty
 * readable that does nothing when read from.
 */
class EmptyReadableStream extends Readable {
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
    this._socket = null
    // Keep it clean.
    this._disposable = new CompositeDisposable()
  }

  // AutoLanguageClient needs access to the socket.
  get socket() { return this._socket }

  // We don't have a process id.
  get pid() { return -1 }

  // AutoLanguageClient expects a process with a input and output stream.
  // We, however, don't launch a process. The socket we use can both be read
  // from and written to for the LanguageClient's purposes.
  get stdin() { return this._socket }
  get stdout() { return this._socket }
  get stderr() { return EmptyReadableStream.instance }

  // override
  _start(port, onOpen, onError, onClose) {}

  start(port) {
    return new Promise((resolve, reject) => {

      this._disposable.add(new Disposable(() => {
        if (this._socket) {
          this._socket.destroy()
          this._socket = null
        }
      }))

      const onClose = (code, reason) => {}
      const onOpen = () => { resolve(this) }
      const onError = (error) => { reject(error) }

      this._start(port, onOpen, onError, onClose);
    })
  }

  kill(signal) {
    this._disposable.dispose()
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
        this._socket = WebSocket.createWebSocketStream(webSocket)
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
    this._socket = new net.Socket();
    this._socket.connect(port);
    this._socket
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
    // We may recieve an error response when sending the exit notification:
    // "Received response message without id: Error is: { "code": -32601, "message": "Method not found: exit" }"
    // Additionally, ServerManager both disposes of the current clientConnection
    // and calls the LanguageServerProcess.kill() after calling exit(). The
    // async exit() doesn't expect a response. So when Godot sends back an error
    // response at a later time, we get another error:
    // "Error [ERR_STREAM_DESTROYED]: Cannot call write after a stream was destroyed"
    // The following fixes the above errors and allows a clean exit AFAICT:
    clientConnection.exit = () => {}
  }

  getDatatip(editor, point) {
    if (this.datatip && !this._hasPatchedDatatipAdapter) {
      require('./datatip-adapter-patch')(this.datatip)
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
    const s = this.socket
    return s && !s.destroyed && s.readable && s.writable
  }

}
