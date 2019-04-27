module.exports = class ParserInterface {
	parse({text, file, object}) {
		console.assert('ParserInterface.parse() must be overriden.')
	}
}
