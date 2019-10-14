# lang-gdscript package

![](https://raw.githubusercontent.com/IndicaInkwell/language-gdscript/master/lang-gdscript-demo.png)

GDScript (Godot Scripting Language) grammar for atom.io.

### Features

- Syntax highlighting for gd, tres, tscn, and project.godot files.
- Autocomplete for GDScript provided by Godot (v3.2+)

### Dependencies

- **Python2** is needed for node-gyp to build [tree-sitter-gdscript](https://github.com/PrestonKnopp/tree-sitter-gdscript) and [tree-sitter-godot-resource](https://github.com/PrestonKnopp/tree-sitter-godot-resource).
  - **macOS**: comes bundled with python2, so you don't have to worry mac users.
  - **Windows**: You may not have to worry. I have prebuilt Windows binaries that language-gdscript will attempt to download. If it fails then it will fallback to trying to build manually and you'll need to have [python2 installed](https://docs.python-guide.org/starting/install/win/).
  - **Linux**: Here is a guide on [installing python2 for Linux](https://docs.python-guide.org/starting/install/linux/).

### Install

- `apm install lang-gdscript`
  - use lang-gdscript because there's another language-gdscript package
- or from atom > settings > install
  - search `lang-gdscript`

### Usage

- Connecting to Godot's Language Server
  - The Godot Editor must be open to connect.
  - The editor will automatically try connecting when opening a gdscript project.
  - You can try reconnecting at any time by:
    - Going to Packages > Lang GDScript > Reconnect to Godot Editor Language Server
    - Going to command palette and searching GDScript or Reconnect...

### Q&A

- I just want syntax highlighting and tree sitter isn't working, what can I do?
  - Make sure Atom is up to date and try re-installing. Otherwise:
  - The legacy text-mate grammar is still included. You can select the non-tree-sitter grammar which is called `GDScript (Godot Engine)`.
