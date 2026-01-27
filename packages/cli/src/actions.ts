import {
  type ActionCliInputContext,
  type ActionRegistry,
  type ActionSurface,
  type AnyActionSpec,
  createContext as createHandlerContext,
  DEFAULT_REGISTRY_SURFACES,
  type HandlerContext,
  validateInput,
} from "@outfitter/contracts";
import { Command } from "commander";

export interface BuildCliCommandsOptions {
  readonly createContext?: (input: {
    action: AnyActionSpec;
    args: readonly string[];
    flags: Record<string, unknown>;
  }) => HandlerContext;
  readonly includeSurfaces?: readonly ActionSurface[];
}

type ActionSource = ActionRegistry | readonly AnyActionSpec[];

const ARGUMENT_PREFIXES = ["<", "["];

function isArgumentToken(token: string | undefined): boolean {
  if (!token) {
    return false;
  }
  return ARGUMENT_PREFIXES.some((prefix) => token.startsWith(prefix));
}

function splitCommandSpec(spec: string): {
  name: string | undefined;
  args: string[];
} {
  const parts = spec.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { name: undefined, args: [] };
  }
  return { name: parts[0], args: parts.slice(1) };
}

function applyArguments(command: Command, args: string[]): void {
  for (const arg of args) {
    command.argument(arg);
  }
}

function applyCliOptions(command: Command, action: AnyActionSpec): void {
  const options = action.cli?.options ?? [];
  for (const option of options) {
    if (option.required) {
      command.requiredOption(
        option.flags,
        option.description,
        option.defaultValue
      );
    } else {
      command.option(option.flags, option.description, option.defaultValue);
    }
  }
}

function resolveDescription(action: AnyActionSpec): string {
  return action.cli?.description ?? action.description ?? action.id;
}

function resolveAliases(action: AnyActionSpec): readonly string[] {
  return action.cli?.aliases ?? [];
}

function resolveCommandSpec(action: AnyActionSpec): string {
  return action.cli?.command ?? action.id;
}

function resolveFlags(command: Command): Record<string, unknown> {
  return (command.optsWithGlobals?.() ?? command.opts()) as Record<
    string,
    unknown
  >;
}

function resolveInput(
  action: AnyActionSpec,
  context: ActionCliInputContext
): unknown {
  if (action.cli?.mapInput) {
    return action.cli.mapInput(context);
  }

  const hasFlags = Object.keys(context.flags).length > 0;
  if (!hasFlags && context.args.length === 0) {
    return {};
  }

  return {
    ...context.flags,
    ...(context.args.length > 0 ? { args: context.args } : {}),
  };
}

async function runAction(
  action: AnyActionSpec,
  command: Command,
  createContext: (input: {
    action: AnyActionSpec;
    args: readonly string[];
    flags: Record<string, unknown>;
  }) => HandlerContext
): Promise<void> {
  const flags = resolveFlags(command);
  const args = command.args as string[];
  const inputContext: ActionCliInputContext = { args, flags };
  const input = resolveInput(action, inputContext);
  const validation = validateInput(action.input, input);

  if (validation.isErr()) {
    throw validation.error;
  }

  const ctx = createContext({ action, args, flags });

  const result = await action.handler(validation.value, ctx);
  if (result.isErr()) {
    throw result.error;
  }
}

function createCommand(
  action: AnyActionSpec,
  createContext: (input: {
    action: AnyActionSpec;
    args: readonly string[];
    flags: Record<string, unknown>;
  }) => HandlerContext,
  spec?: string
): Command {
  const commandSpec = spec ?? resolveCommandSpec(action);
  const { name, args } = splitCommandSpec(commandSpec);

  if (!name) {
    throw new Error(`Missing CLI command name for action ${action.id}`);
  }

  const command = new Command(name);
  command.description(resolveDescription(action));
  applyCliOptions(command, action);
  applyArguments(command, args);

  for (const alias of resolveAliases(action)) {
    command.alias(alias);
  }

  command.action(async (...argsList: unknown[]) => {
    const commandInstance = argsList.at(-1) as Command;
    await runAction(action, commandInstance, createContext);
  });

  return command;
}

export function buildCliCommands(
  source: ActionSource,
  options: BuildCliCommandsOptions = {}
): Command[] {
  const actions = isActionRegistry(source) ? source.list() : source;
  const includeSurfaces: readonly ActionSurface[] = options.includeSurfaces ?? [
    "cli",
  ];
  const commands: Command[] = [];
  const createContext =
    options.createContext ??
    ((_input) =>
      createHandlerContext({
        cwd: process.cwd(),
        env: process.env as Record<string, string | undefined>,
      }));

  const grouped = new Map<string, AnyActionSpec[]>();
  const ungrouped: AnyActionSpec[] = [];

  for (const action of actions) {
    const surfaces: readonly ActionSurface[] =
      action.surfaces ?? DEFAULT_REGISTRY_SURFACES;
    if (!surfaces.some((surface) => includeSurfaces.includes(surface))) {
      continue;
    }

    const group = action.cli?.group;
    if (group) {
      const groupActions = grouped.get(group) ?? [];
      groupActions.push(action);
      grouped.set(group, groupActions);
    } else {
      ungrouped.push(action);
    }
  }

  for (const action of ungrouped) {
    commands.push(createCommand(action, createContext));
  }

  for (const [groupName, groupActions] of grouped.entries()) {
    const groupCommand = new Command(groupName);
    let baseAction: AnyActionSpec | undefined;
    const subcommands: AnyActionSpec[] = [];

    for (const action of groupActions) {
      const spec = action.cli?.command?.trim() ?? "";
      const { name, args } = splitCommandSpec(spec);

      if (!name || isArgumentToken(name)) {
        if (baseAction) {
          throw new Error(
            `Group '${groupName}' defines multiple base actions: '${baseAction.id}' and '${action.id}'.`
          );
        }
        baseAction = action;
        groupCommand.description(resolveDescription(action));
        applyCliOptions(groupCommand, action);
        applyArguments(groupCommand, name ? [name, ...args] : args);

        for (const alias of resolveAliases(action)) {
          groupCommand.alias(alias);
        }

        groupCommand.action(async (...argsList: unknown[]) => {
          const commandInstance = argsList.at(-1) as Command;
          await runAction(action, commandInstance, createContext);
        });
      } else {
        subcommands.push(action);
      }
    }

    for (const action of subcommands) {
      const spec = resolveCommandSpec(action);
      const { name, args } = splitCommandSpec(spec);
      if (!name) {
        continue;
      }
      const subcommand = createCommand(
        action,
        createContext,
        [name, ...args].join(" ")
      );
      groupCommand.addCommand(subcommand);
    }

    if (!baseAction) {
      groupCommand.description(groupName);
    }

    commands.push(groupCommand);
  }

  return commands;
}
function isActionRegistry(source: ActionSource): source is ActionRegistry {
  return "list" in source;
}
