const treeHelpers = require('./tree-sitter-helpers')

function getFirstChildIdentifierText(node) {
	const identifier = node.namedChild(0)
	const identifierText = treeHelpers.getNodeText(identifier)
	return identifierText
}

function getSecondChildConvertedValue(node, converter) {
	const valueNode = node.namedChild(1)
	return converter.convert(valueNode)
}

class GodotResource {
	constructor(nodeTree, resPath=null, converter=NodeDataConverter.Default) {
		this._path = resPath
		this._tree = nodeTree
		this._converter = converter
	}

	getGlobalProperty(path, defaultResult=null) {
		const rootNode = treeHelpers.getTreeRootNode(this._tree)
		if (!rootNode)
			return null

		let result = defaultResult

		for (const node of rootNode.namedChildren) {
			if (node.type === 'comment')
				continue
			if (node.type !== 'property')
				break

			// First child is a path node
			const pathNodeText = getFirstChildIdentifierText(node)

			if (path === pathNodeText) {
				result = getSecondChildConvertedValue(node, this._converter)
				break
			}
		}

		return result
	}

	getSections(kind) {
		const results = []
		this.forEachSection(kind, (section) => results.push(section))
		return results
	}

	forEachSection(kind, callback) {
		const rootNode = treeHelpers.getTreeRootNode(this._tree)
		if (!rootNode)
			return

		for (const sectionNode of rootNode.descendantsOfType('section')) {
			const section = SectionFactory.make(sectionNode)
			if (section.kind === kind) {
				if (callback(section))
					break
			}
		}
	}
}

class GodotSceneResource extends GodotResource {

	getRootNodeSection() {
		let rootNode = null
		this.forEachSection('node', (node) => {
			rootNode = node
			return true
		})
		return rootNode
	}

	findExternalResourceSectionReferencingPath(path) {
		let extResSection = null
		this.forEachSection('ext_resource', (extRes) => {
			if (extRes.path === path) {
				extResSection = extRes
				return true
			}
		})
		return extResSection
	}

	findNodeSectionWithScriptPath(path) {
		const extResSection = this.findExternalResourceSectionReferencingPath(path)
		if (!extRes)
			return null

		let nodeSectionWithScript = null
		this.forEachSection('node', (nodeSection) => {
			const value = nodeSection.getProperty('script')
			if (value instanceof Constructor) {
				if (value.identifier === 'ExtResource' &&
				    value.arguments[0] === extRes.id) {
					nodeSectionWithScript = nodeSection
					return true
				}
			}
		})
		return nodeSectionWithScript
	}

}

class GodotProjectConfigResource extends GodotResource {

	getGlobalClasses() {
		return this.getGlobalProperty('_global_script_classes', [])
	}

	getAutoloadClasses() {
		let result = {}
		const autoloadSections = this.getSections('autoload')
		if (autoloadSections.length > 0) {
			for (const autoloadProperty of autoloadSections[0].properties) {
				result[autoloadProperty.key] = autoloadProperty.value
			}
		}
		return result
	}

}

class NodeDataConverter {
	convert(node) {
		switch (node.type) {
			case 'constructor': return this.convertConstructor(node)
			case 'array': return this.convertArray(node)
			case 'dictionary': return this.convertDictionary(node)
			case 'pair': return this.convertPair(node)
			case 'identifier': return this.convertIdentifier(node)
			case 'number': return this.convertNumber(node)
			case 'string': return this.convertString(node)
			case 'null': return this.convertNull(node)
			case 'true':
			case 'false': return this.convertBool(node)
		}

		return undefined
	}
	convertConstructor(ctrNode) {
		const constructor = new Constructor()
		constructor.name = getFirstChildIdentifierText(ctrNode)
		constructor.arguments = this.convertArray(ctrNode.namedChild(1))
		return constructor
	}
	convertArray(arrNode) {
		const array = []
		for (const value of arrNode.namedChildren)
			array.push(this.convert(value))
		return array
	}
	convertDictionary(dictNode) {
		const dict = {}
		for (const pair of dictNode.namedChildren)
			Object.assign(dict, this.convertPair(pair))
		return dict
	}
	convertPair(pairNode) {
		const key = this.convert(pairNode.namedChild(0))
		const val = this.convert(pairNode.namedChild(1))
		return {[key]: val}
	}
	convertIdentifier(identNode) {
		return treeHelpers.getNodeText(identNode)
	}
	convertNumber(numberNode) {
		return Number(treeHelpers.getNodeText(numberNode))
	}
	convertString(strNode) {
		const withQuotes = treeHelpers.getNodeText(strNode, '""')
		const withoutQuotes = withQuotes.slice(1, -1)
		return withoutQuotes
	}
	convertNull(nullNode) {
		return null
	}
	convertBool(boolNode) {
		return Boolean(treeHelpers.getNodeText(boolNode))
	}
}
NodeDataConverter.Default = new NodeDataConverter()

class Constructor {
	constructor() {
		this.identifier = null
		this.arguments = []
	}
}

class SectionFactory {
	static make(sectionNode) {
		switch (Section.whatKind(sectionNode)) {
			case 'ext_resource':
				return new ExternalResourceSection(sectionNode)
			case 'node':
				return new NodeSection(sectionNode)
			case 'connection':
				return new ConnectionSection(sectionNode)
			default:
				return new Section(sectionNode)
		}
	}
}

class Section {

	static whatKind(sectionNode) {
		return getFirstChildIdentifierText(sectionNode)
	}

	constructor(sectionNode, attributes=new Attributes(), properties=new Properties(), converter=NodeDataConverter.Default) {
		this._node = sectionNode

		this._attributes = attributes
		this._attributes.setSectionNode(this._node)
		this._attributes.setDataConverter(converter)

		this._properties = properties
		this._properties.setSectionNode(this._node)
		this._properties.setDataConverter(converter)
	}

	get kind() { return Section.whatKind(this._node) }
	get attributes() { return this._attributes }
	get properties() { return this._properties }

	getAttribute(name) { this._attributes.get(name) }
	getProperty(path)  { this._properties.get(path) }
}

class ExternalResourceSection extends Section {
	get path() { return this.getAttribute('path') }
	get type() { return this.getAttribute('type') }
	get id()   { return this.getAttribute('id')   }
}

class NodeSection extends Section {
	get name()   { return this.getAttribute('name') }
	get type()   { return this.getAttribute('type') }
	get parent() { return this.getAttribute('parent') }
}

class ConnectionSection extends Section {
	get signal() { return this.getAttribute('signal') }
	get from()   { return this.getAttribute('from') }
	get to()     { return this.getAttribute('to') }
	get method() { return this.getAttribute('method') }
}

class SectionComponent {

	constructor(componentNodeType) {
		this._nodeType = componentNodeType
		this._converter = null
		this._sectionNode = null
	}

	setDataConverter(converter) {
		this._converter = converter
	}

	setSectionNode(sectionNode) {
		this._sectionNode = sectionNode
	}

	getComponentKey(componentNode) {
		return getFirstChildIdentifierText(componentNode)
	}

	getComponentValue(componentNode) {
		return getSecondChildConvertedValue(componentNode, this._converter)
	}

	*[Symbol.iterator]() {
		for (const componentNode of this._sectionNode.descendantsOfType(this._nodeType)) {
			const key = this.getComponentKey(componentNode)
			const val = this.getComponentValue(componentNode)
			yield { key: key, value: val }
		}
	}

	get(key) {
		for (const componentNode of this._sectionNode.descendantsOfType(this._nodeType)) {
			const key = this.getComponentKey(componentNode)
			if (key === name) {
				const val = this.getComponentValue(componentNode)
				return val
			}
		}
	}

}

class Attributes extends SectionComponent {
	constructor() { super('attribute') }
}

class Properties extends SectionComponent {
	constructor() { super('property') }
}

module.exports = {
	General: GodotResource,
	Scene: GodotSceneResource,
	ProjectConfig: GodotProjectConfigResource
}
