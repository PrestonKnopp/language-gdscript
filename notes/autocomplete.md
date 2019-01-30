# Basic Autocompletion using TreeSitter

## Godot Project

The atom project root is used as the Godot project root aka `res://`. This means that you can edit GDScript without having a `godot.project` file. However, symbols for `class_name` and `autoload` will not be accessible.

Each Godot project in the atom workspace will have it's own index. Documentation will be shared so it doesn't use more memory than necessary.

## Index

The index of Godot builtin and user defined symbols and type information.

The index is structured as a ScopeChain in a LookupTable. Each scope in the chain is a Dictionary of symbol strings mapped to a Symbol object. @see below for type information.

There should be a series of persistent scopes made up of:

- Builtins
  - @GDScript
- BuiltinGlobals
  - @GlobalScope
- UserScripts
  - This scope is user gdscripts where the key is the filepath to the file
- UserGlobals
  - This scope is for `class_name` and `autoload` definitions.
  - They should simply map their associated UserScript
- [Temporaries]
  - Additional scopes from the buffer Autocompletion position.
  - The buffer should walk backwards getting all accessible symbols and pushing scopes appropriately
  - Temporaries should be cleared on buffer update


    interface Lookupable<T> {
        lookup(term: string) -> T?
        find(term: string) -> Array<T>
    }

    class Symbol implements Lookupable<Symbol> {
        type: string    // type, method, constant, class, etc.
        text: string    // the symbol text like `Vector2`
        info: structure // a type structure
    }

    class Scope implements Lookupable<Symbol> {
        add(symbol: Symbol)
        remove(symbol: Symbol)
        lookup(symbol: string) -> Symbol?
        find(term: string) -> Array<Symbol>?
    }

    class Index implements Lookupable<Symbol> {
        protected chain: Array<Scope>
        makePersistentScope(named: string) -> Scope
        makeTemporaryScope(scope: object, named: string?) -> Scope
        clearTemporaryScopes()
        getScope(named) -> Scope

        // Direct lookup
        lookup(symbol: string) -> Symbol?
        lookupInScope(scopeName, symbol: string) -> Symbol?
        lookupFromScope(scopeName, symbol: string) -> Symbol?

        // Fuzzy lookup
        find(term: string) -> Array<Symbol>
        findInScope(scopeName, term: string) -> Array<Symbol>
        findFromScope(scopeName, symbol: string) -> Array<Symbol>
    }

### Keeping the Index Up to Date

Use `Atom::File` api to subscribe to change, rename, and delete events to indexed scripts.

Unsubscribe when scripts become active in the text editor. Resubscribe when script is deactivated.

On change, parse file and update type info.
On rename, update script entry and all references that point to it.
On delete, remove script entry and all references that point to it.

## Completion tree-sitter-gdscript Scopes

When in an `attribute` start at the front of the attribute and walk to completion position looking up each identifier to get the completions of the last identifier.

When in `source` or `body` of a class suggest to complete function definitions of inherited classes.

When in a `type` suggest classes.
