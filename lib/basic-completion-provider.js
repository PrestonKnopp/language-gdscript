/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {readFileSync} = require('fs');
const path = require('path');

module.exports = class BasicCompletionProvider {

  constructor() {
    this._completions = null
    this.selector = '.source.gdscript'
    this.disableForSelector = '.punctuation.definition.comment.gdscript, .string.quoted.single.gdscript, .string.quoted.double.gdscript, .variable.parameter.gdscript, .variable.other.gdscript, .variable.parameter.function.gdscript, .punctuation.definition.parameters.comma.gdscript, .punctuation.definition.parameters.space.gdscript, .punctuation.definition.parameters.begin.bracket.round.gdscript, .punctuation.definition.parameters.end.bracket.round.gdscript'
  }

  loadCompletions() {
    const json = JSON.parse(readFileSync(path.resolve(__dirname, '..', 'data', 'documentation_3.1.json')));
    const c = []
    var p = null
    function processMembers(obj) {
      for (p of obj)
      c.push({
        type: 'member',
        text: p.name,
        displayText: p.name,
        description: p.description,
        leftLabel: p.type
      })
    }
    function processMethods(obj) {
      for (p of obj)
      c.push({
        type: 'method',
        text: p.name,
        displayText: p.name,
        description: p.description,
        snippet: p.snippet,
        leftLabel: p.return_.type
      })
    }
    function processConstants(obj) {
      for (p of obj)
      c.push({
        type: 'constant',
        text: p.name,
        displayText: p.name,
        description: p.description,
        leftLabel: p.value
      })
    }
    function processClass(obj) {
      c.push({
        type: 'class',
        text: obj.name,
        displayText: obj.name,
        description: obj.brief_description
      })
      processConstants(obj.constants || [])
      processMembers(obj.members || [])
      processMethods(obj.methods || [])
    }
    for (let key in json) {
      processClass(json[key])
    }

    this._completions = c
  }

  clearCompletions() {
    this._completions = null
  }

  getSuggestions({editor, bufferPosition, scopeDescriptor, prefix}) {
    return new Promise((resolve) => {
      let completions = [];

      for (let c of this._completions) {
        if (c.displayText.startsWith(prefix)) {
          completions.push(c)
        }
      }

      resolve(completions);
    });
  }
}
