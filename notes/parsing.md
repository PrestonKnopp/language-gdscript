# Parsing Godot Project Files

## gd

Use `Atom::GrammarRegistry::grammarForScopeName('scope.gdscript')` and check if it's a tree-sitter grammar. Then parse with `Atom::Grammar::tokenizeLines(text)`.

## godot.project

Scan for a line that begins with `_global_script_classes` then scan until end the array of class objects. Then load as json. This isn't great but it'll work.

## tscn

TODO: scenes
