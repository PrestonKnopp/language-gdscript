const AtomGodotProject = require('./atom-godot-project')

module.exports = {
	selector: '.source.gdscript',
	disableForSelector: '.comment',
	inclusionPriority: 1,
	excludeLowerPriority: true,
	filterSuggestions: true,

	_project: new AtomGodotProject(atom.project.getPaths()[0]),

	getSuggestions(request) {
		const pos = request.bufferPosition
		pos.column--;
		const path = request.editor.getPath().substring(this._project.resourcePath.length + 1)
		this._project.indexTree(request.editor.getBuffer().languageMode.tree)
		console.log(this._project.index)

		const syms = this._project.getSymbols(request.editor, pos, request.prefix) || []
		console.log('Syms:',syms)
		return syms.map((sym) => {
			return {
				text: sym.name,
				type: sym.type
			}
		})
	}
}
