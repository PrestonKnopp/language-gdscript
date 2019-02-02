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

## godot.project

Scan for a line that begins with `_global_script_classes` then scan until end the array of class objects. Then load as json. This isn't great but it'll work.

## tscn

TODO: scenes
