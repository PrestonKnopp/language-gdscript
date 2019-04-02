const {GodotProject} = require('./core')
const {TextBuffer} = require('atom')
const {join} = require('path');

module.exports = class AtomGodotProject extends GodotProject {

	_getLangGDPkgPath() {
		if (!this.__langGDPkgPath)
			this.__langGDPkgPath = atom.packages.resolvePackagePath('lang-gdscript')
		return this.__langGDPkgPath
	}

	_getLangGDGrammar() {
		let grammar = atom.grammars.grammarForScopeName('scope.gdscript')
		if (!grammar) {
			grammar = atom.grammars.loadGrammarSync(join(
					this._getLangGDPkgPath(),
					'grammars/tree-sitter-gdscript.json'
			))
		}

		return grammar
	}

	_parseScript(path) {
		const grammar = this._getLangGDGrammar()
		const buffer = TextBuffer.loadSync(join(this.resourcePath, path))
		const mode = atom.grammars.languageModeForGrammarAndBuffer(grammar, buffer)
		console.log('Script Path: ', join(this.resourcePath, path));
		console.log('Mode: ', mode)
		if (!mode)
			return null

		console.log('Returning mode tree')
		return mode.tree
	}

}
