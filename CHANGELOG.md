## 2.7.0 - Minor
* Added support functions with support.function class
* Removed unneccessary entity.name.function  
  * Fixed support for the [goto](https://atom.io/packages/goto) package.

## 2.6.0 - Major
* Fixed keywords `and`, `in`, `is`, `not` and `or` not being highlighted (classes "keyword" and "operator" don't mix)
* Fixed `class` not being highlighted properly
* Added highlighting to functions, methods and properties
* Added highlighting to select few standard functions (print, set_*, get_*). Does not work with methods yet.
* Now indents whenever a line of code ends with `:` (i.e. after declaring a function or a class)

## 2.5.0 - Minor
* Added keywords `onready` and `breakpoint`
* Removed debug statements

## 2.4.0 - Minor
* Added ability to disable the completions

## 2.3.0 - Minor
* Updated grammar
    * highlights more like it's supposed to now

## 2.0.1 - Patch
* Fixed comments by setting editor.commentStart = '# '
* Sorted completions for a more convenient selection (also it's a lil faster)
* Lowered completion priority so other stuff, like var names, won't be at bottom of list
* Turned off exclude completions so stuff, like var names, will actually show up in list

## 2.0.0 - Second Release
* Added autocomplete support!

## 0.1.0 - First Release
* Converted sublime text language plugin to atom
