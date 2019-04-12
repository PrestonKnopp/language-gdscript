const AtomGodotProject = require('./atom-godot-project')

module.exports = {
	selector: '.source.gdscript',
	disableForSelector: '.comment',
	inclusionPriority: 1,
	excludeLowerPriority: true,
	filterSuggestions: true,

	_project: new AtomGodotProject(atom.project.getPaths()[0]),

	getSuggestions({editor, bufferPosition, prefix}) {
		bufferPosition.column -= 1

		this._project.indexTree(editor.getBuffer().languageMode.tree)

		const symbols = this._project.getSymbols(editor, bufferPosition, prefix)
		const completions = symbols.map((symbol) => {
			const completion = {
				text: symbol.name,
				type: symbol.type,
				description: symbol.info['description']
			}
			switch (symbol.type) {
				case 'method':
					completion['leftLabel'] = symbol.info['return_']['type']
					completion['snippet'] = symbol.info['completion']
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
