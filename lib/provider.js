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
			return {
				text: symbol.name,
				type: symbol.type
			}
		})

		return completions
	}
}
