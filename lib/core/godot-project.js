const structs = require('./structures')
const treeHelpers = require('./tree-sitter-helpers')
const utility = require('./utility')

const DEFAULT_INHERITANCE = 'Reference'

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
LookerUpper.Default = new LookerUpper()

class Symbol {
	constructor(structure, lookerUpper=LookerUpper.Default) {
		this._info = structure
		this._lookerUpper = lookerUpper

		this._scope = null
	}

	_setScope(scope) { this._scope = scope }
	getScope() { return this._scope }

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
	constructor(lookerUpper=LookerUpper.Default, linkItem=null) {
		this._symbolMap = {}
		this._lookerUpper = lookerUpper
		this._linkItem = linkItem
	}

	// -- LinkItem

	clearLinkItem() {
		this._linkItem.data = null
		this._linkItem = null
	}

	getLinkItem() {
		return this._linkItem
	}

	setLinkItem(item) {
		this._linkItem = item
		item.data = self // ref cycle
	}

	getPrevScope() {
		if (this._linkItem)
			return this._linkItem.prev
		return null
	}

	getNextScope() {
		if (this._linkItem)
			return this._linkItem.next
		return null
	}

	// -- Symbols

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
		symbol._setScope(this)
	}

	remove(symbol) {
		delete this._symbolMap[symbol.name]
	}

	lookup(term) { return this._lookerUpper.lookup(term, this._symbolMap) }
	find(term) { return this._lookerUpper.find(term, this._symbolMap) }
}

class ScopeChain {
	constructor() {
		this._linkedList = new utility.DoubleLinkedList()
		this._scopes = []
	}

	getScopes() {
		return this._scopes
	}

	append(scope) {
		this._scopes.push(scope)

		const linkItem = new utility.LinkedListItem()
		this._linkedList.append(linkItem)
		scope.setLinkItem(linkItem)
	}

	prepend(scope) {
		this._scopes.unshift(scope)

		const linkItem = new utility.LinkedListItem()
		this._linkedList.prepend(linkItem)
		scope.setLinkItem(linkItem)
	}

	insert(scope, afterScope) {
		const idx = this._scopes.indexOf(afterScope)
		console.assert(idx > -1)
		this._scopes.splice(idx, 0, scope)

		const linkItem = new utility.LinkedListItem()
		this._linkedList.insert(linkItem, afterScope.getLinkItem())
		scope.setLinkItem(linkItem)
	}

	remove(scope) {
		const idx = this._scopes.indexOf(scope)
		if (idx > -1) this._scopes.splice(idx, 1)
		if (scope.getLinkItem()) {
			this._linkedList.remove(scope.getLinkItem())
			scope.clearLinkItem()
		}

	}
}

class Index {
	constructor() {
		this._scopeChain = new ScopeChain()
		this._scopeMeta = {
			temporary: [],
			persistent: {}
		}
	}

	addPersistentScope(named, scope) {
		this._scopeMeta.persistent[named] = scope
		this._scopeChain.append(scope)
	}

	makePersistentScopes(...names)  {
		for (const name of names)
			this.addPersistentScope(name, new Scope())
	}

	getPersistentScope(named) {
		return this._scopeMeta.persistent[named]
	}

	addTemporaryScope(scope) {
		const lastTempScope = utility.last(this._scopeMeta.temporary)
		if (lastTempScope) {
			this._scopeChain.insert(scope, lastTempScope)
		} else {
			this._scopeChain.prepend(scope)
		}
		this._scopeMeta.temporary.push(scope)
	}

	makeTemporaryScope() {
		const scope = new Scope()
		this.addTemporaryScope(scope)
		return scope
	}

	clearTemporaryScopes() {
		for (const tempScope of this._scopeMeta.temporary) {
			this._scopeChain.remove(tempScope)
		}
		this._scopeMeta.temporary = []
	}

	_lookup(term, useFind=false, fromScope=null) {
		const result = {
			output: null,
			scope: null
		}

		const scopes = this._scopeChain.getScopes()
		let startIdx = 0
		if (fromScope) {
			const idx = scopes.indexOf(fromScope)
			if (idx > -1) startIdx = idx + 1
		}

		for (let i = startIdx, len = scopes.length; i < len; i++) {
			result.scope = scopes[i]
			if (useFind) {
				result.output = result.scope.find(term)
				if (result.output.length) break
			} else {
				result.output = result.scope.lookup(term)
				if (result.output) break
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

		inheritanceType = utility.normalizeQuotes(inheritanceType)

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
			case 'signal_statement':
				struct = structs.makeSignal({
					name: nodeName
				})
				const identifierList = treeHelpers.getLastNamedChildOfNode(node)
				if (identifierList && identifierList.type === 'identifier_list') {
					identifierList.namedChildren.forEach((identifier, index) => {
						struct.arguments.push(structs.makeArgument({
							index: index,
							name: treeHelpers.getNodeText(identifier)
						}))
					})
				}
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
		let scope = new Scope()
		const scopes = [scope]

		let breakWalk = false
		treeHelpers.walkBackwards(node, (prevNode) => {
			switch (prevNode.type) {
				case 'body':
					scope = new Scope()
					scopes.push(scope)
					break
				case 'signal_statement':
					// do not add signal_statements to local scope
					break
				case 'class_definition':
					// break walk if node is inside class_definition.
					// can't access outside of inner classes
					breakWalk = prevNode.range.containsRange(node.range)
					// continue to default so that inner class will still
					// be in scope
				default:
					const struct = this.structure(prevNode)
					if (struct) {
						const sym = new Symbol(struct)
						if (sym.type === 'method') {
							for (const arg of sym.info['arguments']) {
								scope.add(new Symbol(arg))
							}
						}
						scope.add(sym)
					}
					break
			}
			return breakWalk
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
				case 'signal_statement':
					classStack[0].struct.signals[struct.name] = new Symbol(struct)
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
	constructor(resourcePath, treeFormer=new TreeFormer(), index=new Index()) {
		this.resourcePath = resourcePath
		this._former = treeFormer
		this._index = index
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

	// -- Project Symbols

	lookupInClassSymbolAncestry(classSymbol, term) {
		let result = null
		while (classSymbol && !result) {
			result = classSymbol.lookup(term)
			classSymbol = this.getParentClassSymbolOfClassSymbol(classSymbol)
		}
		return result
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

	getAllClassSymbols() {
		const results = []
		const builtinsScope = this.index.getPersistentScope('builtins')
		for (const symbol of builtinsScope.getSymbols()) {
			if (symbol.type === 'class')
				results.push(symbol)
		}
		return results
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

	getSymbolsForIdentifier(node, prefix='') {
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

	getSymbolsForAttribute(node, toNode, withPrefix) {
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
			    (child.type === 'attribute_call')      ||
			    (child.type === 'call')) {
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

	// -- Documentation data

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
