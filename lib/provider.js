const AtomGodotProject = require('./atom-godot-project')

function makeCompletionJump(name, idx) {
	return `\${${idx}` + (name==''?'':(':'+name)) + '}'
}

function makeEmbeddedCompletionJump(outer, inner, idx) {
	let innerJump = makeCompletionJump(inner, idx + 1)
	return makeCompletionJump(outer + innerJump, idx)
}

function makeMethodCompletionSnippet(method) {
	const vararged = (method.qualifiers || '').includes('vararg')
	const arglen = method.arguments.length + Number(vararged)
	let text = method.name + '('
	// Arguments is an array like object with string indices? Where did the
	// string indices come from?
	for (let i = 0; i < method.arguments.length; i++) {
		const argument = method.arguments[i]
		if (argument.default) {
			const defstr = argument.name + ' defaults to ' + argument.default
			if (i > 0) {
				text += makeEmbeddedCompletionJump(', ', defstr, i + 1)
			} else {
				text += makeCompletionJump(defstr, i + 1)
			}
		} else {
			text += makeCompletionJump(argument.name, i + 1)

			if (i + 1 < method.arguments.length && !method.arguments[i + 1].default) {
				text += ', '
			}
		}
	}

	if (vararged) {
		if (arglen > 1) {
			text += makeEmbeddedCompletionJump(', ', 'vararg', arglen)
		} else {
			text += makeCompletionJump('vararg', arglen)
		}
	}

	text += ')${0}'
	return text
}

module.exports = {
	selector: '.source.gdscript',
	disableForSelector: '.comment',
	inclusionPriority: 1,
	excludeLowerPriority: true,
	filterSuggestions: true,

	_project: new AtomGodotProject(atom.project.getPaths()[0]),

	getSuggestions({editor, bufferPosition, prefix}) {
		bufferPosition.column -= 1

		const path = editor.getPath()

		this._project.indexTree(
			editor.getBuffer().languageMode.tree,
			path
		)

		console.log('path:', path)

		const symbols = this._project.getSymbols(editor, bufferPosition, prefix, path)
		const completions = symbols.map((symbol) => {
			const completion = {
				text: symbol.name,
				type: symbol.type,
				description: symbol.info['description']
			}
			switch (symbol.type) {
				case 'method':
					completion['leftLabel'] = symbol.info['return_']['type']
					completion['snippet'] = makeMethodCompletionSnippet(symbol.info)
					break
				case 'constant':
					completion['rightLabel'] = symbol.info['value']
					completion['leftLabel'] = symbol.info['enum']
					break
				case 'member':
					completion['leftLabel'] = symbol.info['type']
					break
			}
			return completion
		})

		return completions
	}
}
