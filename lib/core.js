const structs = require('./structures')
const treeHelpers = require('./tree-sitter-helpers')

class LookerUpper {
	lookup(term, dictionary) {
		return dictionary[term]
	}
	find(term, dictionary) {
		let results = []
		for (const key in dictionary) {
			if (key.includes(term))
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

	makePersistentScopes(...names)  {
		for (const name of names)
			this._scopeChain.persistent[name] = new Scope()
	}

	getPersistentScope(named) {
		return this._scopeChain.persistent[named]
	}

	makeTemporaryScope() {
		const scope = new Scope()
		this._scopeChain.temporary.push(scope)
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

class GodotProject {
	constructor(resourcePath) {
		this.resourcePath = resourcePath
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

	_parseScript(path) {
		return null
	}

	indexScript(path) {
		const tree = this._parseScript(path)
		if (!tree)
			return

		function finish(index, symbol) {
			symbol.info['name'] = path
			structs.mapClassProperties(symbol.info)
			index.getPersistentScope('userScripts').add(symbol)
		}

		let {
			getNodeText,
			getNodeName,
			getNodeType,
			getFirstChildOfNodeWithType,
			getLastChildOfNode
		} = treeHelpers

		getFirstChildOfNodeWithType = getFirstChildOfNodeWithType.bind(treeHelpers)
		getNodeName = getNodeName.bind(treeHelpers)
		getNodeType = getNodeType.bind(treeHelpers)

		const scriptStruct = structs.makeClass()
		const scriptSymbol = new Symbol(scriptStruct)

		const cursor = tree.walk()
		if (!cursor.gotoFirstChild()) {
			return finish(this.index, scriptSymbol)
		}

		const classStack = [{struct: scriptStruct, node: cursor.currentNode}]
		outerLoop: while (true) {

			const nodeName = getNodeText(getNodeName(cursor.currentNode))

			switch (cursor.nodeType) {


				case 'class_definition':


					const classStruct = structs.makeClass({
						name: nodeName,
						// Inner Classes inherit Reference by default
						inherits: getNodeText(getNodeType(cursor.currentNode), 'Reference')
					})

					classStack.unshift({
						struct: classStruct,
						node: cursor.currentNode
					})


					break
				case 'function_definition':


					const methodStruct = structs.makeMethod({
						name: nodeName
					})

					const params = getFirstChildOfNodeWithType(cursor.currentNode, 'parameters')
					let index = 0
					for (const param of params.namedChildren) {
						methodStruct.arguments.push(structs.makeArgument({
							name: getNodeText(getFirstChildOfNodeWithType(param, 'identifier')),
							type: getNodeText(getFirstChildOfNodeWithType(param, 'type')),
							index: index++,
						}))
					}

					methodStruct.return_ = structs.makeReturn({
						type: getNodeText(getFirstChildOfNodeWithType(
							getFirstChildOfNodeWithType(cursor.currentNode, 'return_type'),
							'type'
						))
					})

					classStack[0].struct.methods.push(methodStruct)


					break
				case 'variable_statement':
				case 'export_variable_statement':
				case 'onready_variable_statement':


					const setget = cursor.currentNode.descendantsOfType('setget')[0]

					const memberStruct = structs.makeMember({
						name: nodeName,
						type: getNodeText(getFirstChildOfNodeWithType(cursor.currentNode, 'type')),
						setter: getNodeText(getFirstChildOfNodeWithType(setget, 'setter')),
						getter: getNodeText(getFirstChildOfNodeWithType(setget, 'getter'))
					})

					classStack[0].struct.members.push(memberStruct)


					break
				case 'const_statement':


					const constStruct = structs.makeConstant({
						name: nodeName,
						value: getNodeText(getLastChildOfNode(cursor.currentNode))
					})

					classStack[0].struct.constants.push(constStruct)

			} // end switch(cursor.nodeType)

			// When there are no more siblings shift and reset to
			// last class node. If there's no more on stack then break.
			while (!cursor.gotoNextSibling()) {
				if (classStack.length > 1) {
					const lastClassStruct = classStack.shift().struct
					structs.mapClassProperties(lastClassStruct)
					classStack[0].struct.classes.push(lastClassStruct)
					cursor.reset(classStack[0].node)
				} else {
					break outerLoop
				}
			}
		}

		finish(this.index, scriptSymbol)
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
				scope.add(new Symbol(cls))
			}
		}
	}
}

module.exports = {
	structs,
	GodotProject,
	Symbol
}
