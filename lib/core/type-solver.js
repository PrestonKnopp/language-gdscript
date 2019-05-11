const treeHelpers = require('./tree-sitter-helpers')

/*
Solving Types
-------------

# What we'll need

- reference to Index
	- to lookup types and identifiers with scope
- recursive series of solve* methods that return a resolved symbol

# To do

- move impls of GodotProject::getSymbolsForAttribute and
  GodotProject::getSymbolsForAttribute here. It is necessary to solve
	for types. Steps needed for use:

	- Scope it to only solve for a complete attribute i.e. (node, toNode) -> (node)
	- Remove array return

	It can then be used by GodotProject like:
	getSymbolsForAttribute(node, toNode) {
		// ... code to reduce attribute node to a single complete attribute ...
		const partialAttribute // = ...
		return this.getAllSymbolsOfClassSymbolAncestry(this._typeSolver.solveAttribute(partialAttribute))
	}
*/
module.exports = class TypeSolver {

	constructor(index, symbolSupplier, treeFormer) {
		this._index = index
		this._supplier = symbolSupplier
		this._former = treeFormer
	}

	// Dependencies
	setIndex(index) { this._index = index }
	setSupplier(supplier) { this._supplier = supplier }
	setFormer(former) { this._former = former }

	// Solving Methods
	solve(node) {
		switch (node.type) {
			case 'export_variable_statement':
			case 'variable_statement':
			case 'const_statement':
				let possibleExpressionNode = node.lastNamedChild
				if (!possibleExpressionNode)
					break
				switch (possibleExpressionNode.type) {
					case 'name':
					case 'inferred_type':
						// there is no expression node
						break
					case 'setget':
						const prevSib = possibleExpressionNode.previousNamedSibling
						if (!prevSib)
							break
						if (prevSib.type === 'name' || prevSib.type === 'inferred_type')
							break
						possibleExpressionNode = prevSib
					default:
						// quite possible it is an expression node
						return this.solveExpressionNode(possibleExpressionNode)
				}
				break
		}

		return null
	}

	solveExpressionNode(node) {
		switch (node.type) {
			case 'not_operator': // bool
			case 'boolean_operator': // bool
			case 'comparison_operator': return this._getBuiltinSymbol('bool')
      case 'conditional_expression': return this.solveConditionalExpressionNode(node)
			default: return this.solvePrimaryExpressionNode(node)
		}
	}

	solveConditionalExpressionNode(node) {
		// TODO: need to define Union type interface because duck typing
		// TODO: use Union type to handle both branches of condition expr
		// right now this just uses the first branch e.g. 'first_branch if true else second_branch'
		return this.solveExpressionNode(node.firstChild)
	}

	solvePrimaryExpressionNode(node) {
		switch (node.type) {

			// atoms
			case 'true': // bool
			case 'false': return this._getBuiltinSymbol('bool')
			case 'null': return this._getBuiltinSymbol('null')
			case 'string': return this._getBuiltinSymbol('String')
			case 'float': return this._getBuiltinSymbol('float')
			case 'integer': return this._getBuiltinSymbol('int')
			case 'node_path': return this._getBuiltinSymbol('NodePath')
			case 'get_node': return this._getBuiltinSymbol('Node')
			case 'list': return this._getBuiltinSymbol('Array')
			case 'dictionary': return this._getBuiltinSymbol('Dictionary')

			// additional operators
      case 'binary_operator': return this.solveBinaryOperatorExpressionNode(node)
      case 'unary_operator': return this.solveUnaryOperatorExpressionNode(node)

			// main expressions
      case 'identifier': return this.solveIdentifierNode(node)
      case 'attribute': return this.solveAttributeNode(node)
      case 'subscript': return this.solveSubscriptNode(node)
      case 'base_call': // solveCallNode
      case 'call': return this.solveCallNode(node)

			// other expressions
      case 'parenthesized_expression': return this.solveParenthesizedExpressionNode(node)

			default: return null
		}
	}

	solveParenthesizedExpressionNode(node) {
		return this.solveExpressionNode(node.child(1))
	}

	solveBinaryOperatorExpressionNode(node) {
		const operator = node.child(1)
		switch (operator.type) {
			case 'is': return this._getBuiltinSymbol('bool')
			case 'as': return this.solveIdentifierNode(node.child(2))
			// just return the type of the left operand to cheat a bit
			default: return this.solvePrimaryExpressionNode(node.child(0))
		}
	}

	solveUnaryOperatorExpressionNode(node) {
		return this.solvePrimaryExpressionNode(node.child(1))
	}

	solveIdentifierNode(node) {
		let lookupText = node.text
		let lookupResultSymbol = null

		if (lookupText === 'self') {
			lookupResultSymbol = this._former.formSelfClassSymbolFromNode(node)
		} else {
			lookupResultSymbol = this._index.lookup(lookupText)
			if (!lookupResultSymbol)
				lookupResultSymbol = this._supplier.getSymbolOfTermInClassSymbolAncestry(
					lookupText,
					this._former.formSelfClassSymbolFromNode(node)
				)

			lookupResultSymbol = this.resolve(lookupResultSymbol)
		}
		return lookupResultSymbol
	}

	solveAttributeNode(node, upToNode=null) {
		let lookupText = ''
		let lookupResultSymbol = null
		let child = null

		// If we are in this function, we know that an attribute must have
		// a leading identifier, call, base_call, or subscript
		child = node.namedChild(0)
		switch (child.type) {
			case 'identifier': lookupResultSymbol = this.solveIdentifierNode(child)
			case 'call':
			case 'base_call': lookupResultSymbol = this.solveCallNode(child)
			case 'subscript': lookupResultSymbol = this.solveSubscriptNode(child)
			default: console.error('unexpected first node in attribute: ', child)
		}

		// The first attribute in lookupResultSymbol should now be resolved to a class type.
		// We can look for the rest of the attributes

		for (let i = 1, l = node.namedChildCount; i < l; i++) {
			child = node.namedChild(i)

			if (!lookupResultSymbol)
				break

			if (uptoNode && (child === upToNode || child.startIndex > upToNode.startIndex))
				break

			switch (child.type) {
				case 'attribute_call': lookupResultSymbol = this.solveCallNode(child)
				case 'attribute_subscript': lookupResultSymbol = this.solveSubscriptNode(child)
				default: lookupResultSymbol = this.solveIdentifierNode(child)
			}

		}

		return lookupResultSymbol
	}

	solveSubscriptNode(node) {
		return solveCallNode(node) // Same logic
	}

	solveCallNode(node) {
		const ident = treeHelpers.getFirstChildOfNodeWithType(node, 'identifier')
		return solveIdentifierNode(ident)
	}

	resolve(symbol) {
		let oldSymbol = null
		while (symbol) {

			// Hack:
			// Check for recursive lookup.
			// This happens when a symbol is named the same as its type and in a
			// lower scope.
			if (oldSymbol === symbol) {
				const lastScope = this._index.getLastLookupScope()
				symbol = this._index.lookupAfterScope(symbol.info['type'], lastScope)

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
					symbol = this._index.lookup(symbol.info['alias'])
					break
				case 'method':
					symbol = this._index.lookup(symbol.info['return_'].type)
					break
				case 'member':
				case 'argument':
				case 'return_':
					symbol = this._index.lookup(symbol.info['type'])
					break
				default:
					console.error('Attempting to resolve unresolvable symbol type: ', symbol.type);
					symbol = null
			}
		}

		return symbol
	}

	_getBuiltinSymbol(named) {
		const builtins = this._index.getPersistentScope('builtins')
		return builtins.lookup(named)
	}

}
