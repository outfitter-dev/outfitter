---
"outfitter": patch
---

CLI polish: add `--cwd` to `doctor` and `add` commands, normalize `check` output mode to use `--output` preset (keep `--ci` as deprecated alias), fix "check check" display in schema, normalize `/tmp` paths via `realpath`, filter upgrade scan by positional args, and surface workspace version conflicts in `upgrade` output.
