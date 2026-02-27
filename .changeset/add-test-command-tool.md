---
"@outfitter/testing": minor
---

Add `testCommand()` and `testTool()` wiring test helpers. `testCommand(cli, args, options?)` wraps `captureCLI()` to execute CLI instances and return captured stdout, stderr, and exitCode without side effects. `testTool(tool, input, options?)` validates input against the tool's Zod schema and invokes the handler with a test context — invalid input returns a ValidationError without calling the handler.
