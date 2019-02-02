const provider = require('./provider');
const {TextBuffer} = require('atom')

module.exports = {
  config: {
    disableBasicCompletions: {
      type: 'boolean',
      default: false
    }
  },

  activate () {
    const path = atom.packages.resolvePackagePath('lang-gdscript')

		// const buffer = new TextBuffer({text: 'var hello: String = "Hello, World!"'})
    const buffer = TextBuffer.loadSync(path + '/test2.gd')

		let grammar = atom.grammars.grammarForScopeName('source.gdscript')
    if (!grammar) {
      grammar = atom.grammars.loadGrammarSync(path + '/grammars/tree-sitter-gdscript.json')
    }

		const mode = atom.grammars.languageModeForGrammarAndBuffer(grammar, buffer)
    console.log(mode);
  },
  getProvider () { return provider }
}
