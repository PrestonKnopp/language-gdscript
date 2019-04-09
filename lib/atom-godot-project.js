const GodotProject = require('./core/core')
const {TextBuffer} = require('atom')
const {join} = require('path');
const treeHelpers = require('./core/tree-sitter-helpers')

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

	_parseTree(buffer) {
		const grammar = this._getLangGDGrammar()
		const mode = atom.grammars.languageModeForGrammarAndBuffer(grammar, buffer)
		if (!mode)
			return null

		return mode.tree
	}

	_parseScript(path) {
		const buffer = TextBuffer.loadSync(join(this.resourcePath, path))
		return this._parseTree(buffer)
	}

	_parseSource(text) {
		const buffer = new TextBuffer({text})
		return this._parseTree(buffer)
	}

	getSymbols(editor, position, prefix) {
		const tree = this._parseTree(editor.getBuffer())
		if (!tree) return []

		const node = tree.rootNode.namedDescendantForPosition(position)
		this.indexLocalScope(node)

		switch (node.type) {
			case 'attribute':
				return this._processAttribute(node)
			case 'identifier':
				if (node.parent.type === 'attribute')
					return this._processAttribute(node.parent)
				else
					return this._processIdentifier(node)
			default: ;
		}
	}

	_processIdentifier(node) {
		return this.index.find(node.text)
	}

	_processAttribute(node) {
		let result = this.index
		for (const i in node.namedChildren) {
			const child = node.namedChildren[i]
			if (i == (node.namedChildren.length - 1)) {
				result = result.find(child.text)
				console.log('Finding: ', child.text, result);
			}
			else {
				result = this.resolveSymbolType(result.lookup(child.text))
				console.log('Looking Up: ', child.text, result);
			}
		}
		return result
	}

}
