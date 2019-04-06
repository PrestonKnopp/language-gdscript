const {GodotProject} = require('./core')
const {TextBuffer} = require('atom')
const {join} = require('path');
const treeHelpers = require('./tree-sitter-helpers')

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

		position.column -= 1
		const node = tree.rootNode.namedDescendantForPosition(position)
		console.log(node.type, '->', node.text);
		console.log(node.parent.type, '->', node.parent.text);

		switch (node.type) {
			case 'attribute':
				return this._processAttribute(node)
			case 'identifier':
				if (node.parent.type === 'attribute')
					return this._processAttribute(node)
				else
					return this._processIdentifier(node)
			default: ;
		}
	}

	_indexNodeScope(node) {
		this.index.clearTemporaryScopes()

		let scope = this.index.makeTemporaryScope()
		treeHelpers.walkBackwards(node, (prevNode) => {
			switch (prevNode.type) {
				case 'variable_statement':

					break;
				default:

			}
		})
	}

	_processAttribute(node) {
		let result = this
		for (const child of node.children) {
			if (child.text === 'return') continue
			result = result.lookup(child.text)
		}
		return result
	}

	_resolveSymbolType(symbol) {
		while (symbol) {
			if (symbol.type === 'class')
				break

			switch (symbol.type) {
				case 'alias':
					symbol = this.lookup(symbol.info['alias'])
					break
				case 'method':
					symbol = symbol.info['return_']
					// let this pass through to lookup type from 'return_'
				case 'member':
				case 'argument':
				case 'return_':
					symbol = this.lookup(symbol.info['type'])
					break
				default:
					console.error('Attempting to resolve unresolvable symbol type: ', symbol.type);
					symbol = null
			}
		}

		return symbol
	}

}
