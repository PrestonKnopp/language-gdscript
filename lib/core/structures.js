
function mapPropertyValue(values) {
  let map = {}
  for (const value of values) {
    map[value['name']] = value
  }
  return map
}

exports.makeArgument = function(blueprint)  {
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

exports.makeReturn = function(blueprint)  {
  return Object.assign(
    {
      _type: 'return',
      type: '',
      description: ''
    },
    blueprint
  )
}

exports.makeMethod = function(blueprint)  {
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

exports.makeConstant = function(blueprint)  {
  return Object.assign(
    {
      _type: 'constant',
      name: '',
      value: '',
      enum: '',
      description: ''
    },
    blueprint
  )
}

exports.makeMember = function(blueprint)  {
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

exports.makeSignal = function(blueprint)  {
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

exports.makeLink = function(blueprint)  {
  return Object.assign(
    {
      description: ''
    },
    blueprint
  )
}

exports.makeTutorials = function(blueprint)  {
  return Object.assign(
    {
      links: []
    },
    blueprint
  )
}

exports.makeDemos = function(blueprint)  {
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
      description: '',
      brief_description: '',
      tutorials: [],
      demos: [],
      classes: [],
      methods: [],
      constants: [],
      members: [],
      signals: [],

      getMethod(idx) {
        return makeMethod(this.methods[idx])
      },

      getMember(idx) {
        return makeMember(this.members[idx])
      },

      getConstant(idx) {
        return makeConstant(this.constants[idx])
      },

      getSignal(idx) {
        return makeSignal(this.signals[idx])
      }
    },
    blueprint
  )
}

exports.mapClassProperties = function(classStruct) {
  for (const property of ['classes', 'methods', 'constants', 'members', 'signals']) {
    classStruct[property] = mapPropertyValue(classStruct[property])
  }
}

exports.makeAlias = function(blueprint) {
  return Object.assign(
    {
      _type: 'alias',
      name: '',
      alias: {}
    },
    blueprint
  )
}
