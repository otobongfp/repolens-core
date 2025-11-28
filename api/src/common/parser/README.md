# Tree-sitter Language Configuration

This directory contains the YAML configuration for tree-sitter language parsers.

## Configuration File

`languages.yaml` defines all supported languages and their tree-sitter parser modules.

## Adding a New Language

To add support for a new language:

### 1. Install the tree-sitter package

```bash
npm install tree-sitter-<language>
```

### 2. Add to `languages.yaml`

```yaml
- name: <language-name>
  extensions: [ext1, ext2, ext3]  # File extensions
  module: tree-sitter-<language>  # npm package name
  export: default                 # Export name (usually 'default' or specific export)
  aliases: [alias1, alias2]       # Alternative names
```

### Example: Adding Lua

```yaml
- name: lua
  extensions: [lua]
  module: tree-sitter-lua
  export: default
  aliases: [lua]
```

### 3. Restart the application

The parser will automatically load the new language configuration on startup.

## Supported Languages

Currently supported (as of latest update):

- **JavaScript** (js, jsx, mjs, cjs)
- **TypeScript** (ts, tsx)
- **Python** (py, pyw, pyi)
- **Rust** (rs)
- **C#** (cs)
- **C** (c, h)
- **C++** (cpp, cxx, cc, c++, hpp, hxx, hh, h++)
- **Go** (go)
- **Ruby** (rb, rbw, rake, gemspec)
- **Java** (java)
- **PHP** (php, phtml)
- **Swift** (swift)
- **Kotlin** (kt, kts)
- **Scala** (scala, sc)
- **JSON** (json)
- **YAML** (yaml, yml)
- **Markdown** (md, markdown)
- **HTML** (html, htm)
- **CSS** (css)
- **Bash/Shell** (sh, bash, zsh)

## Module Export Types

Different tree-sitter packages export their languages differently:

- **Default export**: `export: default` (most common)
- **Named export**: `export: typescript` (e.g., tree-sitter-typescript)
- **Sub-export**: `export: tsx` (e.g., tree-sitter-typescript exports both `typescript` and `tsx`)

Check the package documentation or source to determine the correct export name.

## Troubleshooting

### Parser not loading

1. Check that the npm package is installed: `npm list tree-sitter-<language>`
2. Verify the export name in the package's `index.js`
3. Check application logs for initialization errors

### Fallback to regex

If a parser fails to initialize, the system automatically falls back to regex-based extraction. Check logs for warnings.

## Configuration Structure

```yaml
languages:
  - name: <unique-name>
    extensions: [<ext1>, <ext2>]  # File extensions (without dot)
    module: <npm-package-name>      # Must match installed package
    export: <export-name>           # How the language is exported
    aliases: [<alias1>, <alias2>]   # Alternative identifiers
```

## Best Practices

1. **Use lowercase names**: Language names should be lowercase
2. **Include common extensions**: Add all common file extensions for the language
3. **Add aliases**: Include common abbreviations and alternative names
4. **Test after adding**: Verify the parser works with sample files
5. **Document special cases**: Note any language-specific quirks in comments

