import { describe, expect, it } from "bun:test";
import { Command } from "commander";
import { createCompletionCommand, generateCompletion } from "../completion.js";

describe("createCompletionCommand", () => {
  describe("defaults", () => {
    it("creates a 'completion' command", () => {
      const cmd = createCompletionCommand();
      expect(cmd.name()).toBe("completion");
    });

    it("has a description", () => {
      const cmd = createCompletionCommand();
      expect(cmd.description()).toBeTruthy();
    });

    it("accepts a shell argument", () => {
      const cmd = createCompletionCommand();
      const args = cmd.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0]?.name()).toBe("shell");
    });

    it("includes all three shells in description by default", () => {
      const cmd = createCompletionCommand();
      const desc = cmd.description();
      expect(desc).toContain("bash");
      expect(desc).toContain("zsh");
      expect(desc).toContain("fish");
    });
  });

  describe("custom config", () => {
    it("accepts custom program name", () => {
      const cmd = createCompletionCommand({ programName: "mycli" });
      expect(cmd.name()).toBe("completion");
    });

    it("limits shells in description", () => {
      const cmd = createCompletionCommand({
        shells: ["bash", "zsh"],
      });
      const desc = cmd.description();
      expect(desc).toContain("bash");
      expect(desc).toContain("zsh");
      expect(desc).not.toContain("fish");
    });

    it("infers program name from parent command when not configured", async () => {
      const root = new Command("mycli");
      root.addCommand(createCompletionCommand());

      let captured = "";
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((
        chunk: string | Uint8Array,
        encodingOrCallback?: BufferEncoding | ((error?: Error) => void),
        callback?: (error?: Error) => void
      ) => {
        captured +=
          typeof chunk === "string"
            ? chunk
            : Buffer.from(chunk).toString("utf8");

        const done =
          typeof encodingOrCallback === "function"
            ? encodingOrCallback
            : callback;
        done?.();
        return true;
      }) as typeof process.stdout.write;

      try {
        await root.parseAsync(["completion", "bash"], { from: "user" });
      } finally {
        process.stdout.write = originalWrite;
      }

      expect(captured).toContain("mycli");
      expect(captured).not.toContain("program");
    });
  });
});

describe("generateCompletion", () => {
  describe("bash", () => {
    it("generates a bash completion script", () => {
      const script = generateCompletion("bash", "mycli");
      expect(script).toBeDefined();
      expect(script).toContain("mycli");
      expect(script).toContain("complete -F");
      expect(script).toContain("_mycli_completions");
    });

    it("includes setup instructions", () => {
      const script = generateCompletion("bash", "mycli");
      expect(script).toContain("~/.bashrc");
    });
  });

  describe("zsh", () => {
    it("generates a zsh completion script", () => {
      const script = generateCompletion("zsh", "mycli");
      expect(script).toBeDefined();
      expect(script).toContain("mycli");
      expect(script).toContain("compdef");
      expect(script).toContain("_mycli");
    });

    it("includes compdef directive", () => {
      const script = generateCompletion("zsh", "mycli");
      expect(script).toContain("#compdef mycli");
    });
  });

  describe("fish", () => {
    it("generates a fish completion script", () => {
      const script = generateCompletion("fish", "mycli");
      expect(script).toBeDefined();
      expect(script).toContain("mycli");
      expect(script).toContain("complete -c mycli");
    });

    it("includes file path hint", () => {
      const script = generateCompletion("fish", "mycli");
      expect(script).toContain("completions/mycli.fish");
    });
  });

  describe("unsupported shell", () => {
    it("returns undefined for unknown shell", () => {
      expect(generateCompletion("powershell", "mycli")).toBeUndefined();
    });

    it("returns undefined for prototype property keys", () => {
      expect(generateCompletion("__proto__", "mycli")).toBeUndefined();
      expect(generateCompletion("constructor", "mycli")).toBeUndefined();
      expect(generateCompletion("toString", "mycli")).toBeUndefined();
    });
  });

  describe("program name substitution", () => {
    it("uses custom program name throughout", () => {
      const script = generateCompletion("bash", "my-special-tool");
      expect(script).toContain("my-special-tool");
      expect(script).not.toContain("mycli");
    });

    it("sanitizes bash function names for hyphenated program names", () => {
      const script = generateCompletion("bash", "my-special-tool");
      expect(script).toContain("_my_special_tool_completions()");
      expect(script).toContain(
        "complete -F _my_special_tool_completions my-special-tool"
      );
    });

    it("sanitizes zsh function names for hyphenated program names", () => {
      const script = generateCompletion("zsh", "my-special-tool");
      expect(script).toContain("_my_special_tool()");
      expect(script).toContain("compdef _my_special_tool my-special-tool");
    });

    it("rejects unsafe program names", () => {
      expect(() => generateCompletion("bash", "mycli;rm -rf /")).toThrow(
        "Invalid program name for shell completion"
      );
    });
  });
});
