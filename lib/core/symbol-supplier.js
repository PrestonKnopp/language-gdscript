module.exports = class SymbolSupplier {

	constructor(index) {
		this._index = index
	}

	getSymbolOfTermInClassSymbolAncestry(term, classSymbol) {
		let result = null
		while (classSymbol && !result) {
			result = classSymbol.lookup(term)
			classSymbol = this.getParentClassSymbolOfClassSymbol(classSymbol)
		}
		return result
	}

	getAllClassSymbols() {
		const results = []
		for (const scope of this._index.getScopes()) {
			for (const symbol of scope.getSymbols()) {
				if (symbol.type === 'class' || symbol.type === 'alias')
					results.push(symbol)
			}
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
		return this._index.lookup(inherits)
	}

}
