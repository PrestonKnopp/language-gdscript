# lang-gdscript package

![](https://raw.githubusercontent.com/IndicaInkwell/language-gdscript/master/lang-gdscript-demo.png)

GDScript (Godot Scripting Language) grammar for atom.io.

Converted from the sublime text grammar: https://github.com/beefsack/GDScript-sublime

### Features

- Syntax highlighting
- Autocompletion! (using autocomplete+)

### Hopes and Dreams
- Would be cool to have some ide like features other then just basic string matched autocompletion. If anyone has any pointers or contributions on where to begin for gdscript that would be awesome! For example, (I haven't checked in a while) but I believe godot binary provides a way to compile gdscript via command line. I wonder if there is like a syntax analysis or dump-ast option.

### Install

- `apm install lang-gdscript`
- or from atom > settings > install

### TODOS

- [DONE] Fix Comments
- [DONE] ~~Remove~~ Reduce Duplicates
- [DONE] Reduce Precedence
- [DONE] Turn Off Exclude Lower Precedenc
- [DONE] Add Classes to completions (totally forgot)
- [DONE] Add class extends snippet (as clex)
- [DONE] Disable .variable.other.gdscript
- [DONE] Add scope of class/method/constant/signal to right label
- [] follow grammar guidelines more strictly
- [] correct some of the entities that won't highlight individual pieces (typing `class` won't highlight until you have `class Name:`)
