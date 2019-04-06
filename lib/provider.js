const AtomGodotProject = require('./atom-godot-project')

module.exports = {
	selector: '.source.gdscript',
	disableForSelector: '.comment',
	inclusionPriority: 1,
	filterSuggestions: true,

	_project: new AtomGodotProject(atom.project.getPaths()[0]),

	getSuggestions(request) {
		console.log(this._project.getSymbols(request.editor, request.bufferPosition, request.prefix));
		console.log(request.prefix, request);
		const path = request.editor.getPath().substring(this._project.resourcePath.length + 1)
		this._project.indexScript(path)
		const script = this._project.index.lookup(path)
		return (this._project.index.find(request.prefix) || []).concat(
			script.find(request.prefix))
			.map((symbol) => {
				return {
					type: symbol._type,
					leftLabel: symbol['return_'] ? symbol.return_.type : '',
					text: symbol.name + (symbol._type === 'method' ? '(' + symbol.arguments.map((a) => `${a.name}:${a.type}`).join(', ') + ')' : '()')
				}
		})
	}
}
