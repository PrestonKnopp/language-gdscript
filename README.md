# lang-gdscript package

![](https://raw.githubusercontent.com/IndicaInkwell/language-gdscript/master/lang-gdscript-demo.png)

GDScript (Godot Scripting Language) grammar for atom.io.

Converted from the sublime text grammar: https://github.com/beefsack/GDScript-sublime

### Features

- Syntax highlighting
- Autocompletion! (using autocomplete+). Will be obsolete! Check out: [atom-autocomplete-gdscript](https://atom.io/packages/autocomplete-gdscript) by [neikeq](https://github.com/neikeq/atom-autocomplete-gdscript)
- Symbol generation with [goto](https://atom.io/packages/goto) package

### Install

- `apm install lang-gdscript`
- or from atom > settings > install

### TODOS

- [DONE] Fix Comments
- [DONE] ~~Remove~~ Reduce Duplicates
- [DONE] Reduce Precedence
- [DONE] Turn Off Exclude Lower Precedence
- [DONE] Add Classes to completions (totally forgot)
- [DONE] Add class extends snippet (as clex)
- [DONE] Disable .variable.other.gdscript
- [DONE] Add scope of class/method/constant/signal to right label
- [DONE] Correct some of the entities that won't highlight individual pieces (typing `class` won't highlight until you have `class Name:`)
- [DONE] add the other support functions (this is going give a long, *long* list)
- [DONE] fix support for [goto](https://atom.io/packages/goto) package (symbol generator)
- [] follow grammar guidelines more strictly
- [] add better completions using the base class
- [] update docs
- [] have setget be a capture group instead of match to highlight when used syntactically correct
