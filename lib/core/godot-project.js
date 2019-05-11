const ParserInterface = require('./parser-interface')
const GodotResource = require('./godot-resource')
const TypeSolver = require('./type-solver')
const SymbolSupplier = require('./symbol-supplier')
const structs = require('./structures')
const treeHelpers = require('./tree-sitter-helpers')
const utility = require('./utility')
const {join} = require('path')

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

		this._lastLookupResult = {}
	}

	getScopes() {
		return this._scopeChain.getScopes()
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

	getTemporaryScopes() {
		return this._scopeMeta.temporary
	}

	_lookup(term, useFind=false, fromScope=null) {
		this._lastLookupResult['output'] = null
		this._lastLookupResult['scope'] = null

		const scopes = this._scopeChain.getScopes()
		let startIdx = 0
		if (fromScope) {
			const idx = scopes.indexOf(fromScope)
			if (idx > -1) startIdx = idx + 1
		}

		for (let i = startIdx, len = scopes.length; i < len; i++) {
			this._lastLookupResult.scope = scopes[i]
			if (useFind) {
				this._lastLookupResult.output = this._lastLookupResult.scope.find(term)
				if (this._lastLookupResult.output.length) break
			} else {
				this._lastLookupResult.output = this._lastLookupResult.scope.lookup(term)
				if (this._lastLookupResult.output) break
			}
		}

		return this._lastLookupResult
	}

	getLastLookupScope() {
		return this._lastLookupResult['scope']
	}

	getLastLookupOutput() {
		return this._lastLookupResult['output']
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

	formSelfClassSymbolFromNode(node) {
		let selfClassSymbol = null

		treeHelpers.walkUp(node, (parentNode) => {
			switch (parentNode.type) {
				case 'class_definition':
					selfClassSymbol = this.formClassSymbolFromNode(
						treeHelpers.getLastChildOfNode(parentNode)
					)
					selfClassSymbol.info['inherits'] = this._getInheritingTypeFromClassDefinition(parentNode)
					return true
				case 'source':
					selfClassSymbol = this.formClassSymbolFromNode(parentNode)
					return true
			}
		})

		return selfClassSymbol
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
				case 'function_definition':
					// break walk so you don't go passed function definition
					// self class symbols are already correctly gathered from
					// this.formSelfClassSymbolFromNode()
					//
					// Add arguments to scope so they are still suggested
					for (const arg of this.structure(prevNode)['arguments']) {
						scope.add(new Symbol(arg))
					}
				case 'class_definition':
					// break walk if node is inside class_definition.
					// can't access outside of inner classes
					breakWalk = prevNode.range.containsRange(node.range)
					// continue to default so that inner class will still
					// be in scope
					break
				default:
					const struct = this.structure(prevNode)
					if (struct)
						scope.add(new Symbol(struct))
					break
			}
			return breakWalk
		})
		return scopes
	}

	formSymbolFromTree(tree) {
		// The root of a tree i.e. a gdscript is a class
		return this.formClassSymbolFromNode(tree.rootNode)
	}

	formClassSymbolFromNode(node) {
		const classStruct = structs.makeClass()
		const rootSymbol = new Symbol(classStruct)
		const cursor = new treeHelpers.TreeCursor(node)
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
	constructor(
		resourcePath,
		gdscriptParserInterface=new ParserInterface(),
		resourceParserInterface=new ParserInterface(),
		treeFormer=new TreeFormer(),
		index=new Index(),
		typeSolver=new TypeSolver(null, null, null),
		symbolSupplier=new SymbolSupplier(null)
	) {
		this.resourcePath = resourcePath
		this._parsers = {
			gdscript: gdscriptParserInterface,
			resource: resourceParserInterface
		}
		this._former = treeFormer
		this._index = index
		this._index.makePersistentScopes(
			'userGlobals',
			'userScripts',
			'builtinGlobals',
			'builtins'
		)
		this._typeSolver = typeSolver
		this._symbolSupplier = symbolSupplier
	}

	// -- Index

	get index() {
		return this._index
	}

	_addUserGlobalAlias(name, aliasTo) {
		const userGlobalsScope = this._index.getPersistentScope('userGlobals')
		const classSymbol = this.index.lookup(aliasTo)
		if (classSymbol) {
			const aliasSymbol = new Symbol(structs.makeAlias({
				name: name,
				alias: aliasTo
			}))
			if (classSymbol.info['alias']) {
				const oldAliasSymbol = userGlobalsScope.lookup(classSymbol.info['alias'])
				if (oldAliasSymbol)
					userGlobalsScope.remove(oldAliasSymbol)
			}
			classSymbol.info['alias'] = aliasSymbol.name
			userGlobalsScope.add(aliasSymbol)
		}
	}

	indexProjectConfig() {
		const tree = this._parsers.resource.parse({
			file: join(this.resourcePath, 'project.godot')
		})
		if (!tree)
			return

		const config = new GodotResource.ProjectConfig(tree)

		const classes = config.getGlobalClasses()
		for (const clazz of classes) {
			if (clazz['language'] !== 'GDScript')
				continue

			const className = clazz['class']
			let filePath = clazz['path'].replace('res://', '')
			filePath = join(this.resourcePath, filePath)
			this.indexScript(filePath)

			this._addUserGlobalAlias(className, filePath)
		}

		const autoloadsDictionary = config.getAutoloadClasses()
		for (const autoloadName in autoloadsDictionary) {
			let autoloadFilePath = autoloadsDictionary[autoloadName]

			// TODO: skip scenes for now
			if (autoloadFilePath.indexOf('.tscn') > 0)
				continue

			autoloadFilePath = autoloadFilePath.replace('*res://', '') // the * means it's enabled
			autoloadFilePath = autoloadFilePath.replace('res://', '')
			autoloadFilePath = join(this.resourcePath, autoloadFilePath)

			this.indexScript(autoloadFilePath)
			this._index.getPersistentScope('userGlobals').add(
				new Symbol(structs.makeAlias({
					name: autoloadName,
					alias: autoloadFilePath
				}))
			)
		}
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
		const userScripts = this._index.getPersistentScope('userScripts')
		const oldTreeSymbol = userScripts.lookup(withName)

		const treeSymbol = this._former.formSymbolFromTree(tree)
		treeSymbol.info['name'] = withName

		// Save alias so that add user global alias will update old alias
		if (oldTreeSymbol)
			treeSymbol.info['alias'] = oldTreeSymbol.info['alias']

		userScripts.add(treeSymbol)

		if (treeSymbol.info['class_name']) {
			this._addUserGlobalAlias(
				treeSymbol.info['class_name'],
				treeSymbol.info['name']
			)
		}

	}

	indexSource(text, withName='') {
		this.indexTree(this._parsers.gdscript.parse({text}), withName)
	}

	indexScript(path) {
		this.indexTree(this._parsers.gdscript.parse({file: path}), path)
	}

	// -- Project Symbols

	getSymbolsForIdentifier(node) {
		let results = this._symbolSupplier.getAllClassSymbols()

		const self = this._former.formSelfClassSymbolFromNode(node)
		if (self) {
			results = results.concat(this._symbolSupplier.getAllSymbolsOfClassSymbolAncestry(self))
		}

		for (const tempScope of this.index.getTemporaryScopes()) {
			for (const symbol of tempScope.getSymbols()) {
				results.push(symbol)
			}
		}

		return results
	}

	getSymbolsForAttribute(node, toNode) {
		const resultSymbol = this._typeSolver.solveAttributeNode(node, toNode)
		return this._symbolSupplier.getAllSymbolsOfClassSymbolAncestry(resultSymbol)
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
