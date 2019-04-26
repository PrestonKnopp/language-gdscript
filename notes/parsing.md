# Parsing Godot Project Files

## gd

Use `Atom::GrammarRegistry::grammarForScopeName('scope.gdscript')` and check if it's null. Else use `Atom::GrammarRegistry::loadGrammarSync('path/grammar.json')`.

Once the grammar is loaded will then need to create a TextBuffer for the script file or with a string.

	const {TextBuffer} = require('atom')
	const strBuff = new TextBuffer({text: 'My String'})
	const fileBuff = TextBuffer.loadSync('abs/path/file.gd')

You can get the absolute path to a package with `Atom::Packages::resolvePackagePath(packageName)`.

Last thing to do is to create the language mode with `Atom::GrammarRegistry::languageModeForGrammarAndBuffer(grammar, buffer)`.

Then the `languageMode.tree` will be ready for use.

## godot.project, tscn, tres

Use [tree-sitter-godot-resource](https://github.com/PrestonKnopp/tree-sitter-godot-resource) to parse.

### godot.project

Get global property node that has path: `_global_script_classes`. Get it's associated array node and iterate through it's dictionary nodes. Check if a dictionary pair node contains `"language": "GDScript"` then parse the file pointed to in pair node `"path": "file/path"`. Index the referenced script by both file path and `"class": "ClassName"`.

### tscn

Parse tscn for suggesting `get_node()` paths and using the tscn node entry to find the type of the node returned by `get_node()`. Skip finding node type if the call is a typed statement or expression e.g. `var node: Control = get_node('my/path')` or `get_node('my/path') as Control`.
