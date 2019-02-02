const {GodotProject} = require('./core')
const {TextBuffer} = require('atom')
const path = require('path');

class AtomGodotProject extends GodotProject {

	_getLangGDPkgPath() {
		if (!this.__langGDPkgPath)
			this.__langGDPkgPath = atom.packages.resolvePackagePath('lang-gdscript')
		return this.__langGDPkgPath
	}

	_getLangGDGrammar() {
		let grammar = atom.grammars.grammarForScopeName('scope.gdscript')
		if (!grammar) {
			grammar = atom.grammars.loadGrammarSync(path.join(
					this._getLangGDPkgPath(),
					'grammars/tree-sitter-gdscript.json'
			))
		}

		return grammar
	}

	_parseScript(path) {
		const grammar = this._getLangGDGrammar()
		const buffer = TextBuffer.loadSync(path.join(this.resourcePath, path))
		const mode = atom.grammars.languageModeForGrammarAndBuffer(grammar, buffer)
		if (!mode)
			return null
		return mode.tree
	}

}
