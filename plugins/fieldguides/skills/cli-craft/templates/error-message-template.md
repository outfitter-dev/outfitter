# Error Message Template

## Goals

- _Human readable first_: describe the problem in plain language.
- _Actionable_: include the next step (flag, file path, permission change, docs link).
- _Low noise_: avoid stack traces in normal mode.
- _Correct stream_: errors go to `stderr`.
- _Correct exit code_: non-zero.

## Pattern

```text
Error: <what failed in plain language>
Cause: <most likely cause, if known> (optional)
Fix:   <what the user should do next>
Hint:  <related command / docs> (optional)

For more help: mycmd <subcmd> --help
Docs: <https://example.com/docs/...> (optional)
```

## Examples

### Missing required argument

```text
Error: missing required argument <path>
Fix:   pass a path, or run: mycmd upload --help
```

### Permission error with actionable fix

```text
Error: can't write to /var/log/mycmd/output.txt
Fix:   choose a writable location, or run: chmod u+w /var/log/mycmd/output.txt
```

### Unknown flag (with suggestion)

```text
Error: unknown option: --jon
Fix:   did you mean --json ?
For more help: mycmd --help
```

### Unexpected error (debug path)

```text
Error: unexpected failure while reading config
Fix:   re-run with --debug, and include the log in a bug report
Issues: https://github.com/example/mycmd/issues/new
```
