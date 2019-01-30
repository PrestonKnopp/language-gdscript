# Simple Naive Type Analysis

If below fails use special type (like `__LGDScriptAllTypes__`) that will be used to suggest all symbols.

## Expressions

- use root expression
- If a constant use that value type.
- When a call lookup type
- When an identifier lookup type
- When an attribute do the attribute lookup
- When a dict or array subscript: do nothing

## Variables

- If typed use that.
- Use Expressions
- When unassigned look through source for first assignment and do the above

## Functions

- If return typed use that.
- Scan body for all return statements
  - Use Expressions
