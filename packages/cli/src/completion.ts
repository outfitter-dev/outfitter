/**
 * Shell completion script generation for CLI commands.
 *
 * Creates a `completion <shell>` command that outputs install-ready
 * completion scripts for bash, zsh, and fish.
 *
 * @packageDocumentation
 */

import { Command } from "commander";

/**
 * Configuration for the completion command.
 */
export interface CompletionConfig {
  /** Program name for completion scripts (inferred from CLI name if not provided) */
  readonly programName?: string;
  /** Supported shells (default: bash, zsh, fish) */
  readonly shells?: readonly ("bash" | "zsh" | "fish")[];
}

type Shell = "bash" | "zsh" | "fish";
const SHELL_SAFE_PROGRAM_NAME = /^[A-Za-z0-9._-]+$/;

function assertSafeProgramName(programName: string): void {
  if (SHELL_SAFE_PROGRAM_NAME.test(programName)) return;

  throw new Error(
    `Invalid program name for shell completion: "${programName}".` +
      " Must match /^[A-Za-z0-9._-]+$/."
  );
}

function toShellIdentifier(programName: string): string {
  assertSafeProgramName(programName);
  return programName.replaceAll(/[^A-Za-z0-9_]/g, "_");
}

/**
 * Generate a bash completion script.
 */
function generateBashCompletion(programName: string): string {
  assertSafeProgramName(programName);
  const shellIdentifier = toShellIdentifier(programName);

  return `# bash completion for ${programName}
# Add to ~/.bashrc or ~/.bash_profile:
#   eval "$(${programName} completion bash)"

_${shellIdentifier}_completions() {
  local cur
  cur="\${COMP_WORDS[COMP_CWORD]}"

  COMPREPLY=( $(compgen -W "$(${programName} --help 2>/dev/null | grep -oE '^  [a-z][-a-z]*' | tr -d ' ')" -- "\${cur}") )
}

complete -F _${shellIdentifier}_completions ${programName}
`;
}

/**
 * Generate a zsh completion script.
 */
function generateZshCompletion(programName: string): string {
  assertSafeProgramName(programName);
  const shellIdentifier = toShellIdentifier(programName);

  return `#compdef ${programName}
# zsh completion for ${programName}
# Add to ~/.zshrc:
#   eval "$(${programName} completion zsh)"

_${shellIdentifier}() {
  local -a commands
  commands=($(${programName} --help 2>/dev/null | grep -oE '^  [a-z][-a-z]*' | tr -d ' '))

  _arguments \\
    '1:command:compadd -a commands' \\
    '*::arg:->args'
}

compdef _${shellIdentifier} ${programName}
`;
}

/**
 * Generate a fish completion script.
 */
function generateFishCompletion(programName: string): string {
  assertSafeProgramName(programName);
  return `# fish completion for ${programName}
# Add to ~/.config/fish/completions/${programName}.fish:
#   ${programName} completion fish > ~/.config/fish/completions/${programName}.fish

complete -c ${programName} -f
complete -c ${programName} -n "__fish_use_subcommand" -a "(${programName} --help 2>/dev/null | string match -r '^  [a-z][-a-z]*' | string trim)"
`;
}

const GENERATORS: Record<Shell, (name: string) => string> = {
  bash: generateBashCompletion,
  zsh: generateZshCompletion,
  fish: generateFishCompletion,
};

/**
 * Generate a completion script for the given shell.
 *
 * @param shell - Target shell
 * @param programName - CLI program name
 * @returns The completion script string, or undefined for unsupported shells
 */
export function generateCompletion(
  shell: string,
  programName: string
): string | undefined {
  const generator = Object.hasOwn(GENERATORS, shell)
    ? GENERATORS[shell as Shell]
    : undefined;
  return generator?.(programName);
}

/**
 * Create a `completion <shell>` command that outputs install-ready
 * completion scripts.
 *
 * @param config - Optional configuration
 * @returns A Commander command instance
 *
 * @example
 * ```typescript
 * import { createCLI } from "@outfitter/cli";
 * import { createCompletionCommand } from "@outfitter/cli/completion";
 *
 * const cli = createCLI({ name: "mycli", version: "1.0.0" });
 * cli.register(createCompletionCommand({ programName: "mycli" }));
 * ```
 */
export function createCompletionCommand(config?: CompletionConfig): Command {
  const shells = config?.shells ?? (["bash", "zsh", "fish"] as const);
  const shellSet = new Set<string>(shells);

  const cmd = new Command("completion")
    .description(`Generate shell completion script (${shells.join(", ")})`)
    .argument("<shell>", `Shell type (${shells.join(", ")})`)
    .action((shell: string) => {
      if (!shellSet.has(shell)) {
        cmd.error(
          `error: unsupported shell '${shell}'. Supported: ${shells.join(", ")}`
        );
        return;
      }
      const generator = GENERATORS[shell as Shell];
      if (generator) {
        const programName =
          config?.programName ?? cmd.parent?.name() ?? "program";
        assertSafeProgramName(programName);
        const script = generator(programName);
        process.stdout.write(script);
      }
    });

  return cmd;
}
