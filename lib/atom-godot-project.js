const GodotProject = require('./core/godot-project')
const ParserInterface = require('./core/parser-interface')
const {TextBuffer} = require('atom')
const {join} = require('path')
const treeHelpers = require('./core/tree-sitter-helpers')

class AtomParserInterface extends ParserInterface {
	constructor(packageName, grammarScope, grammarPath) {
		super()
		this._packageName = packageName
		this._grammarScope = grammarScope
		this._grammarPath = grammarPath
	}

	getPackagePath() {
		return atom.packages.resolvePackagePath(this._packageName)
	}

	getGrammar() {
		let grammar = atom.grammars.grammarForScopeName(this._grammarScope)
		if (!grammar) {
			const grammarPackagePath = join(this.getPackagePath(), this._grammarPath)
			grammar = atom.grammars.loadGrammarSync(grammarPackagePath)
		}
		return grammar
	}

	getTreeWithBuffer(buffer) {
		const grammar = this.getGrammar()
		const mode = atom.grammars.languageModeForGrammarAndBuffer(grammar, buffer)
		if (!mode)
			return null

		return mode.tree
	}

	parse({text, file, object}) {
		if (text !== undefined && text !== null) {
			return this.getTreeWithBuffer(new TextBuffer({text}))
		} else if (file !== undefined && file !== null) {
			return this.getTreeWithBuffer(TextBuffer.loadSync(file))
		} else if (object !== undefined && object !== null) {
			if (object.hasOwnProperty('rootNode')) {
				// assume it's a Tree
				return object
			} else if (object.hasOwnProperty('tree')) {
				// assume it's a LanguageMode
				return object.tree
			}
		}

		return null
	}
}

module.exports = class AtomGodotProject extends GodotProject {

	constructor(resourcePath) {
		super(resourcePath,
			new AtomParserInterface(
				'lang-gdscript', 'source.gdscript',
				'grammars/tree-sitter-gdscript.json'
			),
			new AtomParserInterface(
				'lang-gdscript', 'source.godotResource',
				'grammars/tree-sitter-godot-resource.json'
			)
		)
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
		const tree = this._parsers.gdscript.getTreeWithBuffer(buffer)
		if (!tree) return null

		let node = tree.rootNode.descendantForPosition(position)
		if (node.type === '.' && node.parent.hasError()) {
			// 	this occurs when '.' accessor is the last character of a block
			// 	a workaround may be to parse source text but removing the dot character
			let text = buffer.getText()
			// Use the 'a' as placeholder so it will properly parse as an attribute
			// note: slice(0, node.startIndex) parses the the '.' from the original text
			text = text.slice(0, node.startIndex) + '.a' + text.slice(node.endIndex)
			const tree = this._parsers.gdscript.parse({text})

			node = tree.rootNode.descendantForPosition(position)
		}

		return node
	}

}
