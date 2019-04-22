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

	getSymbolKeys() {
		return Object.keys(this._symbolMap)
	}

	getSymbols() {
		return Object.values(this._symbolMap)
	}

	getSymbolMap() {
		return Object.freeze(Object.create(this._symbolMap))
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

	_lookup(term, useFind=false, fromScope=null) {
		let foundFromScope = !fromScope
		const result = {
			output: null,
			scope: null,
			scopeContainer: null,
			index: null
		}
		for (const scopeContainer in this._scopeChain) {
			for (const i in this._scopeChain[scopeContainer]) {
				const scope = this._scopeChain[scopeContainer][i]

				if (!foundFromScope) {
					if (fromScope === scope) {
						foundFromScope = true
					}
					continue
				}

				if (useFind) {
					result.output = scope.find(term)
					if (result.output.length)
						return result
				} else {
					result.output = scope.lookup(term)
					if (result.output)
						return result
				}
			}
		}

		return result
	}

	getTermScopeInfo(term, fromScope=null) {
		return this._lookup(term, false, fromScope)
	}

	lookupAfterScope(term, scope) {
		return this._lookup(term, false, scope).output
	}

	lookup(term) { return this._lookup(term).output }
	find(term) { return this._lookup(term, true).output }
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
			case 'class_name_statement':
				const className = treeHelpers.getNodeText(treeHelpers.getFirstChildOfNodeWithType(node, 'name'))
				struct = {className}
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

		if (!cursor.gotoFirstChild()) {
			return rootSymbol
		}

		outerLoop: while (true) {
			const struct = this.structure(cursor.currentNode)
			switch (cursor.nodeType) {
				case 'class_definition':
					structs.mapClassProperties(struct)
					classStack.unshift({
						struct: struct,
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
				case 'function_definition':
					classStack[0].struct.methods[struct.name] = new Symbol(struct)
					break
				case 'variable_statement':
				case 'export_variable_statement':
				case 'onready_variable_statement':
					classStack[0].struct.members[struct.name] = new Symbol(struct)
					break
				case 'const_statement':
					classStack[0].struct.constants[struct.name] = new Symbol(struct)
					break
				case 'extends_statement':
					classStack[0].struct.inherits = struct.inherits
					break
				case 'class_name_statement':
					classStack[0].struct.class_name = struct.className
					break
			} // end switch(cursor.nodeType)

			// When there are no more siblings shift and reset to
			// last class node. If there's no more on stack then break.
			while (!cursor.gotoNextSibling()) {
				if (classStack.length > 1) {
					const lastClass = classStack.shift()
					classStack[0].struct.classes[lastClass.struct.name] = new Symbol(lastClass.struct)
					cursor.reset(lastClass.node)
				} else {
					break outerLoop
				}
			}
		} // end outerLoop: while (true)

		return rootSymbol
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

	indexTree(tree, withName='') {
		if (!tree) return
		const treeSymbol = this._former.formSymbolFromTree(tree)
		treeSymbol.info['name'] = withName
		this._index.getPersistentScope('userScripts').add(treeSymbol)

		if (treeSymbol.info['class_name']) {
			this._index.getPersistentScope('userGlobals').add(
				new Symbol(structs.makeAlias({
					name: treeSymbol.info['class_name'],
					alias: treeSymbol.info['name']
				}))
			)
		}
	}

	indexSource(text, withName='') {
		this.indexTree(this._parseSource(text), withName)
	}

	indexScript(path) {
		this.indexTree(this._parseScript(path), path)
	}

	resolveSymbolType(symbol) {
		let oldSymbol = null
		while (symbol) {

			// Hack:
			// Check for recursive lookup.
			// This happens when a symbol is named the same as its type and in a
			// lower scope.
			if (oldSymbol === symbol) {
				const scopeInfo = this._index.getTermScopeInfo(symbol.info['type'])
				symbol = this._index.lookupAfterScope(symbol.info['type'], scopeInfo['scope'])

				if (symbol === null) {
					console.error('Missing type information for symbol: ', oldSymbol)
					break
				}
			}

			oldSymbol = symbol

			if (symbol.type === 'class')
				break

			switch (symbol.type) {
				case 'alias':
					symbol = this.index.lookup(symbol.info['alias'])
					break
				case 'method':
					symbol = this.index.lookup(symbol.info['return_'].type)
					break
				case 'member':
				case 'argument':
				case 'return_':
					symbol = this.index.lookup(symbol.info['type'])
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
			// this mapClassProperties and mapping symbols is really dumb
			// needs to be rewritten starting from structures.js
			const cls = structs.mapClassProperties(structs.makeClass(doc[className]))
			const scopeName = className=='@GlobalScope' ? 'builtinGlobals' : 'builtins'
			const scope = this.index.getPersistentScope(scopeName)
			if ((className === '@GDScript') ||
			    (className === '@GlobalScope')) {
				for (const name in cls.methods) {
					scope.add(new Symbol(cls.methods[name]))
				}
				for (const name in cls.members) {
					scope.add(new Symbol(cls.members[name]))
				}
				for (const name in cls.constants) {
					scope.add(new Symbol(cls.constants[name]))
				}
			} else {
				scope.add(new Symbol(cls))
				for (const name in cls.methods) {
					cls.methods.return_ = structs.makeReturn(cls.methods.return_)
					cls.methods[name] = new Symbol(cls.methods[name])
				}
				for (const name in cls.members) {
					cls.members[name] = new Symbol(cls.members[name])
				}
				for (const name in cls.constants) {
					cls.constants[name] = new Symbol(cls.constants[name])
				}
			}
		}
	}
}

GodotProject.Symbol = Symbol
GodotProject.Structures = structs

module.exports = GodotProject
