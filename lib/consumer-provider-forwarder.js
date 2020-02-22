/* Forward consume and provide method calls
 * to a consumerProvider object.
 *
 * Hopefully this eases the use of multiple
 * provider / consumer backends such as the
 * basic completion provider and the lsc.
 */
module.exports = class ConsumerProviderForwarder {

  constructor() {
    this._consumerProvider = null
    this._consumerServices = {}

    this._consumerConsumedMap = new WeakMap()
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
      this._forwardConsume(consumeName, service)
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

    let consumedSet = this._consumerConsumedMap.get(consumer)
    if (!consumedSet) {
      consumedSet = new Set()
      this._consumerConsumedMap.set(consumer, consumedSet)
    }

    if (consumedSet.has(consumeName)) {
      // Don't consume the same service multiple times.
      return
    }

    consumedSet.add(consumeName)

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


// -----------------------------------------------------------------------------
// -                                Consume Methods                            -
// -----------------------------------------------------------------------------


  consumeDatatip(service) { this._forwardConsume('consumeDatatip', service) }
  consumeConsole(service) { this._forwardConsume('consumeConsole', service) }
  consumeLinterV2(service) { this._forwardConsume('consumeLinterV2', service) }
  consumeBusySignal(service) { this._forwardConsume('consumeBusySignal', service) }
  consumeSignatureHelp(service) { this._forwardConsume('consumeSignatureHelp', service) }
}
