module.exports = {
	selector: '.source.gdscript',
	disableForSelector: '.comment',
	inclusionPriority: 1,
	filterSuggestions: true,

	getSuggestions(request) {
		return [{text: 'HelloWorld'}]
	}
}
