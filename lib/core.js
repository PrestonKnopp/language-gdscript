const structs = require('./structures')

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
		this.type = structure['_type']
		this.name = structure['name']
		this.info = structure
		this._lookerUpper = new LookerUpper()
	}

	lookup(term) {
		switch (this.type) {
			case 'class':
				return (
					this._lookerUpper.lookup(term, this.info['constants'] || {}) ||
					this._lookerUpper.lookup(term, this.info['methods'] || {})   ||
					this._lookerUpper.lookup(term, this.info['members'] || {})   ||
					this._lookerUpper.lookup(term, this.info['classes'] || {})
				)
			default:
				return this._lookerUpper.lookup(term, this.info)
		}
	}

	find(term) {
		switch (this.type) {
			case 'class':
				return Array.prototype.concat.apply([], [
					this._lookerUpper.find(term, this.info['constants'] || {}),
					this._lookerUpper.find(term, this.info['methods'] || {}),
					this._lookerUpper.find(term, this.info['members'] || {}),
					this._lookerUpper.find(term, this.info['classes'] || {})
				])
			default:
				return this._lookerUpper.find(term, this.info)
		}
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
	constructor() {
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
