const GodotProject = require('./core/godot-project')
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

	getSymbols(editor, position, prefix, path) {
		let result = []

		const node = this._getPossibleNodeFromBufferWithPosition(
			editor.getBuffer(),
			position
		)

		if (!node)
			return result

		this.indexLocalScope(node)

		const attribute = treeHelpers.getClosestAncestorOfNodeWithTypes(node, ['attribute'])
		if (attribute) {
			result = this.getSymbolsForAttribute(attribute, node, prefix)
		} else {
			switch (node.type) {
				case 'identifier':
					result = this.getSymbolsForIdentifier(node, prefix)
					break
				case 'extends_statement':
				case 'type':
					result = this.getAllClassSymbols()
					break
				case 'name':
					const classDefinition = treeHelpers.getClosestAncestorOfNodeWithTypes(node, ['class_definition'])
					if (!classDefinition) {
						// We are in a func definition, but it's errored out because of incomplete syntax
						// This is a workaround for the parser error
						const classSymbol = this.getParentClassSymbolOfClassSymbol(this.index.lookup(path))
						result = this.getAllMethodSymbolsOfClassSymbolAncestry(classSymbol)
					}
					break
				default: ;
			}
		}

		if (!result)
			result = []
		else if (!Array.isArray(result))
			result = [result]
		return result
	}

	_getPossibleNodeFromBufferWithPosition(buffer, position) {
		const tree = this._parseTree(buffer)
		if (!tree) return null

		let node = tree.rootNode.descendantForPosition(position)
		if (node.type === '.' && node.parent.hasError()) {
			// 	this occurs when '.' accessor is the last character of a block
			// 	a workaround may be to parse source text but removing the dot character
			let text = buffer.getText()
			// Use the 'a' as placeholder so it will properly parse as an attribute
			// note: slice(0, node.startIndex) parses the the '.' from the original text
			text = text.slice(0, node.startIndex) + '.a' + text.slice(node.endIndex)
			const tree = this._parseSource(text)

			node = tree.rootNode.descendantForPosition(position)
		}

		return node
	}

}
