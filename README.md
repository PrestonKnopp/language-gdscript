# lang-gdscript package

![](https://raw.githubusercontent.com/PrestonKnopp/language-gdscript/master/lang-gdscript-demo.png)

GDScript (Godot Scripting Language) grammar for atom.io.

### Features

- Syntax highlighting for gd, tres, tscn, and project.godot files.
- Autocomplete for GDScript provided by Godot (v3.2+)
- [atom-ide-ui](https://github.com/facebookarchive/atom-ide-ui) integration
  - Adds datatips, diagnostics, and hyperclicking support.

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
- or clone this repository
  - from project root run `apm install` then `apm link`

Optionally install `atom-ide-ui` for an IDE like experience:

- `apm install atom-ide-ui`

### Usage

- Connecting to Godot's Language Server
  - The Godot Editor must be open to connect.
  - The editor will automatically try connecting when opening a GDScript file.

- Show GDScript Language Client's status via
  - Packages > Lang GDScript > Show Language Client Status or
  - Searching in the command pallete for Show Language Client Status

### Q&A

- I just want syntax highlighting and tree sitter isn't working, what can I do?
  - Make sure Atom is up to date and try re-installing. Otherwise:
  - The legacy text-mate grammar is still included. You can select the non-tree-sitter grammar which is called `GDScript (Legacy Textmate Grammar)`.

- How come I'm not getting completion results, diagnostics, errors, etc?

First, make sure at least `atom-ide-ui` or the atom-community-ide packages are installed.

Second, make sure the Godot Editor (v3.2+) is open.

Third, make sure the lang-gdscript's server port setting matches the Godot Editor's
language server port.

Lastly, try opening a gdscript file. lang-gdscript will attempt to connect when a
new gdscript file is opened.
