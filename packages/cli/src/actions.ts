/* eslint-disable outfitter/max-file-lines -- CLI action definitions remain grouped so the public action surface stays discoverable. */
import {
  type ActionCliInputContext,
  type ActionCliOption,
  type ActionRegistry,
  type ActionSurface,
  type AnyActionSpec,
  createContext as createHandlerContext,
  DEFAULT_REGISTRY_SURFACES,
  type HandlerContext,
  validateInput,
} from "@outfitter/contracts";
import type { Result } from "better-result";
import { Command } from "commander";

import { composePresets } from "./flags.js";
import { output } from "./output.js";
import { resolveOutputMode } from "./query.js";
import {
  createCommanderOption,
  deriveFlags,
  validateInput as validateSchemaInput,
} from "./schema-input.js";
import { createSchemaCommand, type SchemaCommandOptions } from "./schema.js";
import type { FlagPreset } from "./types.js";

/** Context passed to the `onResult` callback after a handler completes. */
export interface ActionResultContext {
  /** The action spec that was executed. */
  readonly action: AnyActionSpec;
  /** Positional arguments from the CLI invocation. */
  readonly args: readonly string[];
  /** Parsed Commander flags (raw, before Zod validation). */
  readonly flags: Record<string, unknown>;
  /** Validated input passed to the handler (after Zod parsing). */
  readonly input: unknown;
  /** The handler's return value — check `isOk()` / `isErr()` to branch. */
  readonly result: Result<unknown, unknown>;
}

export interface BuildCliCommandsOptions {
  readonly createContext?: (input: {
    action: AnyActionSpec;
    args: readonly string[];
    flags: Record<string, unknown>;
  }) => HandlerContext;
  readonly includeSurfaces?: readonly ActionSurface[];
  /**
   * Called after each handler returns with `Result.ok` or `Result.err`.
   *
   * Defaults to {@link defaultOnResult}, which outputs success values
   * based on CLI flags (`--output`, `--json`, `--jsonl`) and throws errors.
   * Pass `null` to disable and silently discard success values.
   */
  readonly onResult?:
    | ((ctx: ActionResultContext) => void | Promise<void>)
    | null;
  readonly schema?: boolean | SchemaCommandOptions;
}

type ActionSource = ActionRegistry | readonly AnyActionSpec[];

const ARGUMENT_PREFIXES = ["<", "["];

type ResolvedType<T> = T extends FlagPreset<infer R> ? R : never;
type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

type MergedPresetResult<
  TPresets extends readonly FlagPreset<Record<string, unknown>>[],
> =
  UnionToIntersection<ResolvedType<TPresets[number]>> extends Record<
    string,
    unknown
  >
    ? UnionToIntersection<ResolvedType<TPresets[number]>>
    : Record<string, unknown>;

export interface ActionCliPresetAdapter<
  TResolved extends Record<string, unknown>,
> {
  readonly options: readonly ActionCliOption[];
  readonly resolve: (
    input: ActionCliInputContext | Record<string, unknown>
  ) => TResolved;
}

function isInputContext(
  input: ActionCliInputContext | Record<string, unknown>
): input is ActionCliInputContext {
  return (
    "flags" in input &&
    typeof input.flags === "object" &&
    "args" in input &&
    Array.isArray(input.args)
  );
}

/**
 * Compose flag presets for action-spec CLI definitions.
 *
 * Returns an options array for `action.cli.options` and a typed `resolve()`
 * that accepts either raw flags or full `ActionCliInputContext`.
 */
export function actionCliPresets<
  TPresets extends readonly FlagPreset<Record<string, unknown>>[],
>(...presets: TPresets): ActionCliPresetAdapter<MergedPresetResult<TPresets>> {
  const composed = composePresets(...presets);
  return {
    options: composed.options,
    resolve: (input) => {
      const flags = isInputContext(input) ? input.flags : input;
      return composed.resolve(flags) as MergedPresetResult<TPresets>;
    },
  };
}

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

/** Detect whether a Zod schema has a `.shape` property (i.e., is a ZodObject). */
function hasObjectShape(
  schema: unknown
): schema is { shape: Record<string, unknown> } {
  return (
    typeof schema === "object" &&
    schema !== null &&
    "shape" in schema &&
    typeof (schema as Record<string, unknown>)["shape"] === "object"
  );
}

/**
 * Extract the long flag (e.g., `--output-dir`) from a Commander flag string.
 *
 * Handles formats like `-o, --output <value>`, `--verbose`, `--no-color`.
 */
function extractLongFlag(flags: string): string | undefined {
  const match = /--[\w-]+/.exec(flags);
  return match ? match[0] : undefined;
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

  // Auto-derive flags from Zod input schema when it has an object shape.
  // Skip when mapInput is provided — the action handles its own input mapping
  // (often from positional args) and auto-derived required flags would conflict.
  //
  // Note: Derived flags are runtime-only (Commander). They do NOT appear in
  // manifest output (`outfitter schema`). Actions that need manifest coverage
  // should declare explicit `cli.options`.
  if (hasObjectShape(action.input) && !action.cli?.mapInput) {
    const explicitLongFlags = new Set<string>();
    for (const option of options) {
      const longFlag = extractLongFlag(option.flags);
      if (longFlag) {
        explicitLongFlags.add(longFlag);
        // --no-verbose means --verbose is also covered (Commander registers both)
        if (longFlag.startsWith("--no-")) {
          explicitLongFlags.add(`--${longFlag.slice(5)}`);
        }
      }
    }
    // Also collect flags already on the Commander command
    for (const opt of command.options) {
      if (opt.long) {
        explicitLongFlags.add(opt.long);
      }
    }

    const derived = deriveFlags(action.input, explicitLongFlags);
    for (const flag of derived) {
      const commanderOption = createCommanderOption(flag, action.input);
      command.addOption(commanderOption);
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

interface ResolvedInput {
  readonly value: unknown;
  /** When true, the value was already Zod-parsed — skip validateInput(). */
  readonly validated: boolean;
}

function resolveInput(
  action: AnyActionSpec,
  context: ActionCliInputContext
): ResolvedInput {
  if (action.cli?.mapInput) {
    return { value: action.cli.mapInput(context), validated: false };
  }

  // When no mapInput and schema has object shape, extract and validate via Zod.
  // Mark as already validated to avoid double-parse in runAction.
  if (hasObjectShape(action.input)) {
    return {
      value: validateSchemaInput(context.flags, action.input),
      validated: true,
    };
  }

  const hasFlags = Object.keys(context.flags).length > 0;
  if (!hasFlags && context.args.length === 0) {
    return { value: {}, validated: false };
  }

  return {
    value: {
      ...context.flags,
      ...(context.args.length > 0 ? { args: context.args } : {}),
    },
    validated: false,
  };
}

async function runAction(
  action: AnyActionSpec,
  command: Command,
  createContext: (input: {
    action: AnyActionSpec;
    args: readonly string[];
    flags: Record<string, unknown>;
  }) => HandlerContext,
  onResult?: (ctx: ActionResultContext) => void | Promise<void>
): Promise<void> {
  const flags = resolveFlags(command);
  const args = command.args as string[];
  const inputContext: ActionCliInputContext = { args, flags };
  const resolved = resolveInput(action, inputContext);

  // When resolveInput already Zod-parsed (schema-backed actions), skip the
  // second validateInput() pass to avoid redundant parsing.
  let validatedInput: unknown;
  if (resolved.validated) {
    validatedInput = resolved.value;
  } else {
    const validation = validateInput(action.input, resolved.value);
    if (validation.isErr()) {
      // oxlint-disable-next-line outfitter/no-throw-in-handler -- catch-rethrow: outer caller handles error
      throw validation.error;
    }
    validatedInput = validation.value;
  }

  const ctx = createContext({ action, args, flags });

  const result = await action.handler(validatedInput, ctx);

  if (onResult) {
    await onResult({ action, args, flags, input: validatedInput, result });
    return;
  }

  if (result.isErr()) {
    // oxlint-disable-next-line outfitter/no-throw-in-handler -- catch-rethrow: outer caller handles error
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
  spec?: string,
  onResult?: (ctx: ActionResultContext) => void | Promise<void>
): Command {
  const commandSpec = spec ?? resolveCommandSpec(action);
  const { name, args } = splitCommandSpec(commandSpec);

  if (!name) {
    // oxlint-disable-next-line outfitter/no-throw-in-handler -- assertion: invalid input to internal function
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
    await runAction(action, commandInstance, createContext, onResult);
  });

  return command;
}

/**
 * Convert an action registry (or array of action specs) into Commander commands.
 *
 * Actions with a `cli.group` value are automatically collected into nested
 * subcommands under a shared parent command — no manual wiring needed.
 *
 * By default, handler results are auto-output via {@link defaultOnResult}
 * based on CLI flags (`--output`, `--json`, `--jsonl`). Pass `onResult: null`
 * to disable and silently discard success values.
 *
 * @param source - An `ActionRegistry` or array of `AnyActionSpec` to convert
 * @param options - Configuration for context creation, surface filtering, result handling, and schema commands
 * @param options.onResult - Called after each handler completes. Defaults to {@link defaultOnResult}. Pass `null` to disable and silently discard success values (only errors thrown).
 * @param options.createContext - Factory for the `HandlerContext` passed to each handler. Defaults to `createContext({ cwd: process.cwd(), env: process.env })`.
 * @param options.includeSurfaces - Which surfaces to include. Defaults to `["cli"]`.
 * @param options.schema - Controls the auto-generated `schema` subcommand. Pass `false` to disable.
 * @returns Array of Commander `Command` instances ready to register on a program
 *
 * @example
 * ```typescript
 * import { buildCliCommands } from "@outfitter/cli/actions";
 *
 * // Batteries-included: results are auto-output by default
 * for (const command of buildCliCommands(registry)) {
 *   program.register(command);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Custom onResult for logging + output
 * for (const command of buildCliCommands(registry, {
 *   onResult: async (ctx) => {
 *     if (ctx.result.isErr()) throw ctx.result.error;
 *     logger.info("success", { action: ctx.action.id });
 *     const { mode } = resolveOutputMode(ctx.flags);
 *     await output(ctx.result.value, mode);
 *   },
 * })) {
 *   program.register(command);
 * }
 * ```
 */
export function buildCliCommands(
  source: ActionSource,
  options: BuildCliCommandsOptions = {}
): Command[] {
  const actions = isActionRegistry(source) ? source.list() : source;
  const includeSurfaces: readonly ActionSurface[] = options.includeSurfaces ?? [
    "cli",
  ];
  const commands: Command[] = [];
  // Default to defaultOnResult so handler results are auto-output.
  // Pass null to opt out and silently discard success values.
  const onResult:
    | ((ctx: ActionResultContext) => void | Promise<void>)
    | undefined =
    options.onResult === null
      ? undefined
      : (options.onResult ?? defaultOnResult);
  const createContext =
    options.createContext ??
    ((_input) =>
      createHandlerContext({
        cwd: process.cwd(),
        // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: pass env to handler context
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
    commands.push(createCommand(action, createContext, undefined, onResult));
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
          // oxlint-disable-next-line outfitter/no-throw-in-handler -- assertion: duplicate base action in group
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
          await runAction(action, commandInstance, createContext, onResult);
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
        [name, ...args].join(" "),
        onResult
      );
      groupCommand.addCommand(subcommand);
    }

    if (!baseAction) {
      groupCommand.description(groupName);
    }

    commands.push(groupCommand);
  }

  if (options.schema !== false) {
    const hasSchemaCommand = commands.some((cmd) => cmd.name() === "schema");
    if (!hasSchemaCommand) {
      const schemaOptions =
        typeof options.schema === "object" ? options.schema : undefined;
      commands.push(createSchemaCommand(source, schemaOptions));
    }
  }

  return commands;
}
function isActionRegistry(source: ActionSource): source is ActionRegistry {
  return "list" in source;
}

/**
 * Default `onResult` callback that outputs success values and throws errors.
 *
 * Pass this to `buildCliCommands({ onResult: defaultOnResult })` to get
 * automatic output for all handler results without writing a custom wrapper.
 *
 * @example
 * ```typescript
 * const commands = buildCliCommands(registry, {
 *   onResult: defaultOnResult,
 * });
 * ```
 */
export async function defaultOnResult(ctx: ActionResultContext): Promise<void> {
  if (ctx.result.isErr()) {
    // oxlint-disable-next-line outfitter/no-throw-in-handler -- catch-rethrow: consumer boundary
    throw ctx.result.error;
  }

  const { mode } = resolveOutputMode(ctx.flags);
  await output(ctx.result.value, mode);
}
