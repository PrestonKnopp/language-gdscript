const structs = require('./structures')
const treeHelpers = require('./tree-sitter-helpers')

const DEFAULT_INHERITANCE = 'Reference'

function normalizeQuotes(str) {
	return (str || '').replace('"', '\'')
}

class LookerUpper {
	lookup(term, dictionary) {
		return dictionary[term]
	}
	find(term, dictionary) {
		let results = []
		for (const key in dictionary) {
			if (key.startsWith(term))
				results.push(dictionary[key])
		}
		return results
	}
}

class Symbol {
	constructor(structure) {
		this._info = structure
		this._lookerUpper = new LookerUpper()
	}

	get type() {
		return this._info['_type']
	}

	get name() {
		return this._info['name']
	}

	get info() {
		return this._info
	}

	lookup(term) {
		if (this.type === 'class')
			return (
				this._lookerUpper.lookup(term, this.info['constants'] || {}) ||
				this._lookerUpper.lookup(term, this.info['methods'] || {})   ||
				this._lookerUpper.lookup(term, this.info['members'] || {})   ||
				this._lookerUpper.lookup(term, this.info['classes'] || {})
			)
		else
			return this._lookerUpper.lookup(term, this.info)
	}

	find(term) {
		if (this.type === 'class')
			return Array.prototype.concat.apply([], [
				this._lookerUpper.find(term, this.info['constants'] || {}),
				this._lookerUpper.find(term, this.info['methods'] || {}),
				this._lookerUpper.find(term, this.info['members'] || {}),
				this._lookerUpper.find(term, this.info['classes'] || {})
			])
		else
			return this._lookerUpper.find(term, this.info)
	}
}

class Scope {
	constructor() {
		this._symbolMap = {}
		this._lookerUpper = new LookerUpper()
	}

	add(symbol) {
		this._symbolMap[symbol.name] = symbol
	}

	remove(symbol) {
		delete this._symbolMap[symbol.name]
	}

	lookup(term) { return this._lookerUpper.lookup(term, this._symbolMap) }
	find(term) { return this._lookerUpper.find(term, this._symbolMap) }
}

class Index {
	constructor() {
		this._scopeChain = {
			// Order matters, temporaries will be checked before persistents
			temporary: [],
			persistent: {}
		}
	}

	addPersistentScope(named, scope) {
		this._scopeChain.persistent[named] = scope
	}

	makePersistentScopes(...names)  {
		for (const name of names)
			this.addPersistentScope(name, new Scope())
	}

	getPersistentScope(named) {
		return this._scopeChain.persistent[named]
	}

	addTemporaryScope(scope) {
		this._scopeChain.temporary.push(scope)
	}

	makeTemporaryScope() {
		const scope = new Scope()
		this.addTemporaryScope(scope)
		return scope
	}

	clearTemporaryScopes() {
		this._scopeChain.temporary = []
	}

	_lookup(term, isFind=false) {
		const lookup = isFind ? 'find' : 'lookup'
		const check = isFind ? ((r) => r.length) : ((r) => r)
		let result
		for (const scopeContainer in this._scopeChain) {
			for (const i in this._scopeChain[scopeContainer]) {
				const scope = this._scopeChain[scopeContainer][i]
				result = scope[lookup](term)
				if (check(result))
					return result
			}
		}

		return null
	}

	lookup(term) { return this._lookup(term) }
	find(term) { return this._lookup(term, true) }
}

class TreeFormer {

	_getInheritingTypeFromExtendsStatement(node) {
		if (node === null || node.type !== 'extends_statement') {
			return DEFAULT_INHERITANCE
		}

		let inheritanceType = ''
		for (let i = 1; i < node.childCount; i++) {
			inheritanceType += treeHelpers.getNodeText(node.children[i])
		}

		inheritanceType = normalizeQuotes(inheritanceType)

		return inheritanceType
	}

	_getInheritingTypeFromClassDefinition(node) {
		const extendsStmt = treeHelpers.getFirstChildOfNodeWithType(node, 'extends_statement')
		return this._getInheritingTypeFromExtendsStatement(extendsStmt)
	}

	structure(node) {
		const nodeName = treeHelpers.getNodeText(treeHelpers.getNodeName(node))
		let struct = null

		switch (node.type) {
			case 'extends_statement':
				const inherits = this._getInheritingTypeFromExtendsStatement(node)
				struct = {inherits}
				break
			case 'class_definition':
				struct = structs.makeClass({
					name: nodeName,
					inherits: this._getInheritingTypeFromClassDefinition(node)
				})
				break
			case 'function_definition':
				struct = structs.makeMethod({name: nodeName})

				const params = treeHelpers.getFirstChildOfNodeWithType(node, 'parameters')
				for (const i in params.namedChildren) {
					const param = params.namedChildren[i]
					struct.arguments.push(structs.makeArgument({
						name: treeHelpers.getNodeText(treeHelpers.getFirstChildOfNodeWithType(param, 'identifier') || param),
						type: treeHelpers.getNodeText(treeHelpers.getFirstChildOfNodeWithType(param, 'type')),
						index: i,
					}))
				}

				const returnTypeNode = treeHelpers.getFirstChildOfNodeWithType(node, 'return_type')
				const typeNode = treeHelpers.getFirstChildOfNodeWithType(returnTypeNode, 'type')
				struct.return_ = structs.makeReturn({type: treeHelpers.getNodeText(typeNode)})
				break
			case 'variable_statement':
			case 'export_variable_statement':
			case 'onready_variable_statement':
				const setget = node.descendantsOfType('setget')[0]
				struct = structs.makeMember({
					name: nodeName,
					type:   treeHelpers.getNodeText(treeHelpers.getFirstChildOfNodeWithType(node, 'type')),
					setter: treeHelpers.getNodeText(treeHelpers.getFirstChildOfNodeWithType(setget, 'setter')),
					getter: treeHelpers.getNodeText(treeHelpers.getFirstChildOfNodeWithType(setget, 'getter'))
				})
				break
			case 'const_statement':
				struct = structs.makeConstant({
					name: nodeName,
					value: treeHelpers.getNodeText(treeHelpers.getLastChildOfNode(node))
				})
				break
		} // end switch(node.type)
		
		return struct
	}

	formLocalScopesFromNode(node) {
		let scopes = [new Scope()]
		treeHelpers.walkBackwards(node, (prevNode) => {
			switch (prevNode.type) {
				case 'body':
					scopes.push(new Scope())
					break
				default:
					const struct = this.structure(prevNode)
					if (struct) {
						const sym = new Symbol(struct)
						scopes[scopes.length - 1].add(sym)
					}
					break
			}
		})
		return scopes
	}

	formSymbolFromTree(tree) {
		// The root of a tree i.e. a gdscript is a class
		const classStruct = structs.makeClass()
		const rootSymbol = new Symbol(classStruct)
		const cursor = new treeHelpers.TreeCursor(tree.rootNode)
		const classStack = [{struct: classStruct, node: cursor.currentNode}]

		function finish() {
			structs.mapClassProperties(rootSymbol.info)
			return rootSymbol
		}

		if (!cursor.gotoFirstChild()) {
			return finish()
		}

		outerLoop: while (true) {
			const struct = this.structure(cursor.currentNode)
			switch (cursor.nodeType) {
				case 'class_definition':
					classStack.unshift({
						struct: this.structure(cursor.currentNode),
						node: cursor.currentNode
					})

					// Now walk through class body
					const body = treeHelpers.getNodeBody(cursor.currentNode)
					if (body && body.firstChild) {
						cursor.reset(body.firstChild)
						// continue to skip calling cursor.gotoNextSibling() after the
						// switch so body.firstChild will be processed next iter.
						continue
					}
					break
				case 'variable_statement':
				case 'export_variable_statement':
				case 'onready_variable_statement':
					classStack[0].struct.members.push(struct)
					break
				case 'const_statement':
					classStack[0].struct.constants.push(struct)
				case 'extends_statement':
					classStack[0].struct.inherits = struct.inherits
					break
				case 'function_definition':
					classStack[0].struct.methods.push(struct)
					break
			} // end switch(cursor.nodeType)

			// When there are no more siblings shift and reset to
			// last class node. If there's no more on stack then break.
			while (!cursor.gotoNextSibling()) {
				if (classStack.length > 1) {
					const lastClass = classStack.shift()
					structs.mapClassProperties(lastClass.struct)
					classStack[0].struct.classes.push(lastClass.struct)
					cursor.reset(lastClass.node)
				} else {
					break outerLoop
				}
			}
		} // end outerLoop: while (true)

		return finish()
	}
}

class GodotProject {
	constructor(resourcePath) {
		this.resourcePath = resourcePath
		this._former = new TreeFormer()
		this._index = new Index()
		this._index.makePersistentScopes(
			'userGlobals',
			'userScripts',
			'builtinGlobals',
			'builtins'
		)
	}

	get index() {
		return this._index
	}

	_parseSource(text) {
		return null
	}

	_parseScript(path) {
		return null
	}

	indexLocalScope(node) {
		this._index.clearTemporaryScopes()
		if (!node) return
		this._former.formLocalScopesFromNode(node).forEach((scope) => {
			this._index.addTemporaryScope(scope)
		})
	}

	indexTree(tree) {
		if (!tree) return
		const treeSymbol = this._former.formSymbolFromTree(tree)
		this._index.getPersistentScope('userScripts').add(treeSymbol)
	}

	indexSource(text) {
		this.indexTree(this._parseSource(text))
	}

	indexScript(path) {
		this.indexTree(this._parseScript(path))
	}

	resolveSymbolType(symbol) {
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

	initDocumentation(doc) {
		for (const className in doc) {
			const cls = structs.makeClass(doc[className])
			const scopeName = className=='@GlobalScope' ? 'builtinGlobals' : 'builtins'
			const scope = this.index.getPersistentScope(scopeName)
			if (className in ['@GDScript', '@GlobalScope']) {
				for (const name of cls.methods) {
					scope.add(new Symbol(cls.getMethod(name)))
				}
				for (const name of cls.members) {
					scope.add(new Symbol(cls.getMembers(name)))
				}
				for (const name of cls.constants) {
					scope.add(new Symbol(cls.getConstant(name)))
				}
			} else {
				structs.mapClassProperties(cls)
				scope.add(new Symbol(cls))
			}
		}
	}
}

GodotProject.Symbol = Symbol
GodotProject.Structures = structs

module.exports = GodotProject
