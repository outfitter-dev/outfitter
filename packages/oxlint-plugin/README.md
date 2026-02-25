# @outfitter/oxlint-plugin

Custom lint rules for Outfitter architecture and safety conventions.

This package is designed to be consumed by Oxlint JS plugins (`jsPlugins`) and
ESLint v9+ flat config.

## Installation

```bash
bun add -d @outfitter/oxlint-plugin
```

## Usage (Oxlint)

```json
{
  "jsPlugins": [
    {
      "name": "outfitter",
      "specifier": "@outfitter/oxlint-plugin"
    }
  ],
  "rules": {}
}
```

## Usage (ESLint flat config)

```js
import outfitter from "@outfitter/oxlint-plugin";

export default [
  {
    plugins: { outfitter },
    rules: {}
  }
];
```

This scaffold branch (`OS-379`) wires the plugin package and test harness.
Rule implementations land in follow-up issues (`OS-380+`).

## Status

`OS-379` scaffolds the package and test harness. Rules are implemented in
follow-up issues (`OS-380+`).
