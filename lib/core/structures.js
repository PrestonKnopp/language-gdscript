
function mapPropertyValue(values, make) {
	let map = {}
	for (const value of values) {
		map[value['name']] = make(value)
	}
	return map
}

exports.makeArgument = function(blueprint)	{
	return Object.assign(
		{
			_type: 'argument',
			index: '',
			name : '',
			type : '',
			description: ''
		},
		blueprint
	)
}

exports.makeReturn = function(blueprint)	{
	return Object.assign(
		{
			_type: 'return',
			type: '',
			description: ''
		},
		blueprint
	)
}

exports.makeMethod = function(blueprint)	{
	return Object.assign(
		{
			_type: 'method',
			name: '',
			arguments: [],
			qualifiers: '',
			return_: {},
			description: ''
		},
		blueprint
	)
}

exports.makeConstant = function(blueprint)	{
	return Object.assign(
		{
			_type: 'constant',
			name: '',
			value: '',
			type: '',
			enum: '',
			description: ''
		},
		blueprint
	)
}

exports.makeMember = function(blueprint)	{
	return Object.assign(
		{
			_type: 'member',
			name: '',
			type: '',
			setter: '',
			getter: '',
			description: ''
		},
		blueprint
	)
}

exports.makeSignal = function(blueprint)	{
	return Object.assign(
		{
			_type: 'signal',
			name: '',
			arguments: [],
			description: ''
		},
		blueprint
	)
}

exports.makeLink = function(blueprint)	{
	return Object.assign(
		{
			description: ''
		},
		blueprint
	)
}

exports.makeTutorials = function(blueprint)	{
	return Object.assign(
		{
			links: []
		},
		blueprint
	)
}

exports.makeDemos = function(blueprint)	{
	return Object.assign(
		{
			links: []
		},
		blueprint
	)
}

exports.makeClass = function(blueprint) {
	return Object.assign(
		{
			_type: 'class',
			category: '',
			inherits: '',
			name: '',
			class_name: '',
			description: '',
			brief_description: '',
			alias: '',
			tutorials: [],
			demos: [],
			classes: [],
			methods: [],
			constants: [],
			members: [],
			signals: [],
		},
		blueprint
	)
}

exports.mapClassProperties = function(classStruct) {
	classStruct['classes'] = mapPropertyValue(classStruct['classes'], this.makeClass)
	classStruct['methods'] = mapPropertyValue(classStruct['methods'], this.makeMethod)
	classStruct['constants'] = mapPropertyValue(classStruct['constants'], this.makeConstant)
	classStruct['members'] = mapPropertyValue(classStruct['members'], this.makeMember)
	classStruct['signals'] = mapPropertyValue(classStruct['signals'], this.makeSignal)
	return classStruct
}

exports.makeAlias = function(blueprint) {
	return Object.assign(
		{
			_type: 'alias',
			name: '',
			alias: ''
		},
		blueprint
	)
}
