import type { z } from "zod";
import type { OutfitterError } from "./errors.js";
import type { Handler, SyncHandler } from "./handler.js";

export const ACTION_SURFACES = ["cli", "mcp", "api", "server"] as const;

export type ActionSurface = (typeof ACTION_SURFACES)[number];

export const DEFAULT_REGISTRY_SURFACES: readonly ActionSurface[] =
  ACTION_SURFACES;

export interface ActionCliOption {
  readonly flags: string;
  readonly description: string;
  readonly defaultValue?: string | boolean | string[];
  readonly required?: boolean;
}

export interface ActionCliInputContext {
  readonly args: readonly string[];
  readonly flags: Record<string, unknown>;
}

export interface ActionCliSpec<TInput = unknown> {
  readonly group?: string;
  readonly command?: string;
  readonly description?: string;
  readonly aliases?: readonly string[];
  readonly options?: readonly ActionCliOption[];
  readonly mapInput?: (context: ActionCliInputContext) => TInput;
}

export interface ActionMcpSpec<TInput = unknown> {
  readonly tool?: string;
  readonly description?: string;
  readonly deferLoading?: boolean;
  readonly mapInput?: (input: unknown) => TInput;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ActionApiSpec {
  readonly method?: HttpMethod;
  readonly path?: string;
  readonly tags?: readonly string[];
}

export interface ActionTrpcSpec {
  readonly path?: string;
}

export interface ActionSpec<
  TInput,
  TOutput,
  TError extends OutfitterError = OutfitterError,
> {
  readonly id: string;
  readonly description?: string;
  readonly surfaces?: readonly ActionSurface[];
  readonly input: z.ZodType<TInput>;
  readonly output?: z.ZodType<TOutput>;
  readonly handler:
    | Handler<TInput, TOutput, TError>
    | SyncHandler<TInput, TOutput, TError>;
  readonly cli?: ActionCliSpec<TInput>;
  readonly mcp?: ActionMcpSpec<TInput>;
  readonly api?: ActionApiSpec;
  readonly trpc?: ActionTrpcSpec;
}

export type AnyActionSpec = ActionSpec<unknown, unknown, OutfitterError>;

export interface ActionRegistry {
  add<TInput, TOutput, TError extends OutfitterError = OutfitterError>(
    action: ActionSpec<TInput, TOutput, TError>
  ): ActionRegistry;
  list(): AnyActionSpec[];
  get(id: string): AnyActionSpec | undefined;
  forSurface(surface: ActionSurface): AnyActionSpec[];
}

export function defineAction<
  TInput,
  TOutput,
  TError extends OutfitterError = OutfitterError,
>(
  action: ActionSpec<TInput, TOutput, TError>
): ActionSpec<TInput, TOutput, TError> {
  return action;
}

export function createActionRegistry(): ActionRegistry {
  const actions = new Map<string, AnyActionSpec>();

  return {
    add(action) {
      actions.set(action.id, action as AnyActionSpec);
      return this;
    },
    list() {
      return Array.from(actions.values());
    },
    get(id) {
      return actions.get(id);
    },
    forSurface(surface) {
      const defaults = DEFAULT_REGISTRY_SURFACES as readonly ActionSurface[];
      return Array.from(actions.values()).filter((action) =>
        (action.surfaces ?? defaults).includes(surface)
      );
    },
  };
}
