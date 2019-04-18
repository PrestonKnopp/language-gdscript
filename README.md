# lang-gdscript package

![](https://raw.githubusercontent.com/IndicaInkwell/language-gdscript/master/lang-gdscript-demo.png)

GDScript (Godot Scripting Language) grammar for atom.io.

### Features

- Syntax highlighting via tree-sitter-gdscript
- Basic identifier based autocompletion support
- Basic symbol lookup with Atom's builtin symbol viewer
- Supports typed GDScript

### Dependencies

- **Python2** is needed for node-gyp to build tree-sitter-gdscript.
  - **macOS**: comes bundled with python2, so you don't have to worry mac users.
  - **Windows**: You may not have to worry. I have prebuilt Windows binaries that language-gdscript will attempt to download. If it fails then it will fallback to trying to build manually and you'll need to have [python2 installed](https://docs.python-guide.org/starting/install/win/).
  - **Linux**: If you use Linux, then you probably know more about this than I do. If needed, here is a guide on [installing python2 for Linux](https://docs.python-guide.org/starting/install/linux/).

### Install

- `apm install lang-gdscript`
  - use lang-gdscript because there's another language-gdscript package
- or from atom > settings > install
  - search `lang-gdscript`
