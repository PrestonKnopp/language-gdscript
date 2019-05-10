/*
Solving Types
-------------

# What we'll need

- reference to Index
	- to lookup types and identifiers with scope

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

	constructor(index) {
		this._index = index
	}

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
	}

	solveExpressionNode(node) {
		switch (node.type) {
			case 'not_operator': // bool
			case 'boolean_operator': // bool
			case 'comparison_operator': return 'bool'
      case 'conditional_expression': return this.solveConditionalExpressionNode(node)
			default: return this.solvePrimaryExpressionNode(node)
		}
	}

	solveConditionalExpressionNode(node) {

	}

	solvePrimaryExpressionNode(node) {
		switch (node.type) {

			// atoms
			case 'true': // bool
			case 'false': return 'bool'
			case 'null': return 'null'
			case 'string': return 'String'
			case 'float': return 'float'
			case 'integer': return 'int'
			case 'node_path': return 'NodePath'
			case 'get_node': return 'Node'
			case 'list': return 'Array'
			case 'dictionary': return 'Dictionary'

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

	}

	solveBinaryOperatorExpressionNode(node) {

	}

	solveUnaryOperatorExpressionNode(node) {

	}

	solveIdentifierNode(node) {

	}

	solveAttributeNode(node) {

	}

	solveSubscriptNode(node) {

	}

	solveCallNode(node) {

	}

}
