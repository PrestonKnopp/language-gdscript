# lang-gdscript package

![](https://raw.githubusercontent.com/IndicaInkwell/language-gdscript/master/lang-gdscript-demo.png)

GDScript (Godot Scripting Language) grammar for atom.io.

### Features

- Syntax highlighting for gd, tres, tscn, and project.godot files.
- Autocomplete for GDScript
  - Autoloaded scripts
  - Scripts with `class_name`'s
  - Attributes, e.g. `my_node.get_node('other_node').name`
  - Function call snippets
  - Function overrides, e.g. `func _unhandled_key_input(event)`
    - after typing `func <cursor here>`
  - Types e.g.
    - `var node: <cursor here>`
    - `func hello(param: <cursor here>) -> <and cursor here>:`
    - `extends <cursor here>`
- Basic symbol lookup with Atom's builtin symbol viewer
- Supports typed GDScript

### Dependencies

- **Python2** is needed for node-gyp to build [tree-sitter-gdscript](https://github.com/PrestonKnopp/tree-sitter-gdscript) and [tree-sitter-godot-resource](https://github.com/PrestonKnopp/tree-sitter-godot-resource).
  - **macOS**: comes bundled with python2, so you don't have to worry mac users.
  - **Windows**: You may not have to worry. I have prebuilt Windows binaries that language-gdscript will attempt to download. If it fails then it will fallback to trying to build manually and you'll need to have [python2 installed](https://docs.python-guide.org/starting/install/win/).
  - **Linux**: If you use Linux, then you probably know more about this than I do. If needed, here is a guide on [installing python2 for Linux](https://docs.python-guide.org/starting/install/linux/).

### Install

- `apm install lang-gdscript`
  - use lang-gdscript because there's another language-gdscript package
- or from atom > settings > install
  - search `lang-gdscript`
