# command-name

Brief description of what this command does.

## Synopsis

```
my-tool command [options] <required-arg> [optional-arg]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<required-arg>` | Yes | What this argument controls |
| `[optional-arg]` | No | What this optional argument does |

## Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--verbose` | `-v` | `false` | Enable verbose output |
| `--output` | `-o` | `stdout` | Output destination |

## Examples

```bash
# Basic usage
my-tool command input.txt

# With options
my-tool command -v --output result.json input.txt
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Invalid arguments |
