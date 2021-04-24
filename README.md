# lang-gdscript package

![](https://raw.githubusercontent.com/PrestonKnopp/language-gdscript/master/lang-gdscript-demo.png)

GDScript (Godot Scripting Language) grammar for atom.io.

### Features

- Syntax highlighting for gd, tres, tscn, and project.godot files.
- Autocomplete for GDScript provided by Godot (v3.2+)
- [atom-ide-base](https://github.com/atom-community/atom-ide-base) integration
  - Adds datatips, diagnostics, and hyperclicking support.

### Dependencies

Pre-built binaries for [tree-sitter-gdscript](https://github.com/PrestonKnopp/tree-sitter-gdscript) and [tree-sitter-godot-resource](https://github.com/PrestonKnopp/tree-sitter-godot-resource) are available for Linux (64 bit), macOS (64 bit), and Windows (32 & 64 bit).

- **Python2** is needed only when there are no pre-built binaries that match atom or your platform.

### Install

- `apm install lang-gdscript`
  - use lang-gdscript because there's another language-gdscript package
- or from atom > settings > install
  - search `lang-gdscript`
- or clone this repository
  - from project root run `apm install` then `apm link`

Optionally install `atom-ide-base` for an IDE like experience:

- `apm install atom-ide-base`

### Usage

- Connecting to Godot's Language Server
  - The Godot Editor must be open to connect.
  - The editor will automatically try connecting when opening a GDScript file.

- Show GDScript Language Client's status via
  - Packages > Lang GDScript > Show Language Client Status or
  - Searching in the command palette for Show Language Client Status

### Q&A

> I would like syntax highlighting and tree sitter isn't working, what can I do?

Make sure Atom is up to date and try re-installing. Otherwise, the legacy text-mate grammar is still included. You can select the non-tree-sitter grammar which is called `GDScript (Legacy Textmate Grammar)`.

> How come I'm not getting completion results, diagnostics, errors, etc?

1. Make sure the relevant `atom-ide-*` package is installed or `atom-ide-base` which installs all of the atom ide packages.
2. Open the Godot Editor (v3.2+).
3. Check that the lang-gdscript's server port setting matches the Godot Editor's language server port.
4. Try opening a gdscript file. lang-gdscript will attempt to connect when a new gdscript file is opened.

## Changelog

### v6.2.0

- Fixed grammar applying to and causing the linter to lint unrelated files
- Removed basic-completion-provider and old documentation data that bloated the package size.
- Fixed client sockets not closing
- Added a package activationHook. Now the package only activates when a gdscript grammar is used. This reduces startup time to 0ms.
- Added an opt-out setting for the client called `enableGodotLanguageServerClient`
- Fixed errors when closing gdscript file and closing the last gdscript file
- Updated atom-languageclient to v1.0.7
- Added `inferred_type` highlight scope
