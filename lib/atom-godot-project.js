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

	getAllSymbolsOfClassSymbol(classSymbol) {
		const results = []
		if (!classSymbol)
			return results

		const symbolCategories = [
			classSymbol.info['constants'],
			classSymbol.info['methods'],
			classSymbol.info['members'],
			classSymbol.info['classes']
		]
		for (const symbolCategory of symbolCategories) {
			for (const name in symbolCategory) {
				const symbol = symbolCategory[name]
				if (symbol.info)
					results.push(symbol)
			}
		}
		return results
	}

	getParentClassSymbolOfClassSymbol(classSymbol) {
		if (!classSymbol)
			return null
		const inherits = classSymbol.info['inherits']
		if (!inherits)
			return null
		return this.index.lookup(inherits)
	}

	getAllSymbolsOfClassSymbolAncestry(classSymbol) {
		const results = []
		while (classSymbol) {
			const symbols = this.getAllSymbolsOfClassSymbol(classSymbol)
			for (var i = 0, len = symbols.length; i < len; i++) {
				results.push(symbols[i])
			}
			classSymbol = this.getParentClassSymbolOfClassSymbol(classSymbol)
		}
		return results
	}

	getAllClassSymbols() {
		const results = []
		const builtinsScope = this.index.getPersistentScope('builtins')
		for (const symbol of builtinsScope.getSymbols()) {
			if (symbol.type === 'class')
				results.push(symbol)
		}
		return results
	}

	getAllMethodSymbolsOfClassSymbolAncestry(classSymbol) {
		const results = []
		const symbols = this.getAllSymbolsOfClassSymbolAncestry(classSymbol)
		for (const symbol of symbols) {
			if (symbol.type === 'method') {
				results.push(symbol)
			}
		}
		return results
	}

	getSelfClassSymbolFromNode(node) {
		let scopeNode = treeHelpers.getClosestAncestorOfNodeWithTypes(
			node,
			['class_definition', 'source']
		)

		if (scopeNode && scopeNode.type === 'source') {
			scopeNode = treeHelpers.getFirstChildOfNodeWithType(scopeNode, 'extends_statement')
		}

		if (scopeNode) {
			const struct = this._former.structure(scopeNode)
			if (struct['inherits']) {
				return this.index.lookup(struct['inherits'])
			}
		}

		return null
	}

	lookupInClassSymbolAncestry(classSymbol, term) {
		let result = null
		while (classSymbol && !result) {
			result = classSymbol.lookup(term)
			classSymbol = this.getParentClassSymbolOfClassSymbol(classSymbol)
		}
		return result
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
			result = this._processAttribute(attribute, node, prefix)
		} else {
			switch (node.type) {
				case 'identifier':
					result = this._processIdentifier(node, prefix)
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

	_processIdentifier(node, prefix='') {
		let results

		const self = this.getSelfClassSymbolFromNode(node)
		if (self) {
			results = this.getAllSymbolsOfClassSymbolAncestry(self)
		} else {
			results = []
		}

		for (const symbol of this.index.find(prefix)) {
			results.push(symbol)
		}

		return results
	}

	_processAttribute(node, toNode, withPrefix) {
		let result = this.index
		let lookupText = ''

		for (const child of node.children) {

			if (!result)
				break

			if (child === toNode || child.range.containsRange(toNode.range)) {
				if (result.type === 'class')
					result = this.getAllSymbolsOfClassSymbolAncestry(result)
				break
			}

			if ((child.type === 'attribute_subscript') ||
			    (child.type === 'attribute_call')) {
				lookupText = treeHelpers.getFirstChildOfNodeWithType(child, 'identifier').text
			} else {
				lookupText = child.text
			}

			if (!child.isNamed)
				continue

			if (result.type === 'class')
				result = this.lookupInClassSymbolAncestry(result, lookupText)
			else
				result = result.lookup(lookupText)
			result = this.resolveSymbolType(result)

		} // for (const child of node.children)

		if (result === this.index)
			return null
		return result
	}

}
