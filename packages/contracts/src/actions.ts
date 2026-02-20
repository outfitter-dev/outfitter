import type { z } from "zod";
import type { OutfitterError } from "./errors.js";
import type { Handler, SyncHandler } from "./handler.js";

export const ACTION_SURFACES = ["cli", "mcp", "api", "server"] as const;

export type ActionSurface = (typeof ACTION_SURFACES)[number];

export const DEFAULT_REGISTRY_SURFACES: readonly ActionSurface[] =
  ACTION_SURFACES;

export interface ActionCliOption {
  readonly defaultValue?: string | boolean | string[];
  readonly description: string;
  readonly flags: string;
  readonly required?: boolean;
}

export interface ActionCliInputContext {
  readonly args: readonly string[];
  readonly flags: Record<string, unknown>;
}

export interface ActionCliSpec<TInput = unknown> {
  readonly aliases?: readonly string[];
  readonly command?: string;
  readonly description?: string;
  readonly group?: string;
  readonly mapInput?: (context: ActionCliInputContext) => TInput;
  readonly options?: readonly ActionCliOption[];
}

export interface ActionMcpSpec<TInput = unknown> {
  readonly deferLoading?: boolean;
  readonly description?: string;
  readonly mapInput?: (input: unknown) => TInput;
  readonly tool?: string;
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
  readonly api?: ActionApiSpec;
  readonly cli?: ActionCliSpec<TInput>;
  readonly description?: string;
  readonly handler:
    | Handler<TInput, TOutput, TError>
    | SyncHandler<TInput, TOutput, TError>;
  readonly id: string;
  readonly input: z.ZodType<TInput>;
  readonly mcp?: ActionMcpSpec<TInput>;
  readonly output?: z.ZodType<TOutput>;
  readonly surfaces?: readonly ActionSurface[];
  readonly trpc?: ActionTrpcSpec;
}

export type AnyActionSpec = ActionSpec<unknown, unknown, OutfitterError>;

export interface ActionRegistry {
  add<TInput, TOutput, TError extends OutfitterError = OutfitterError>(
    action: ActionSpec<TInput, TOutput, TError>
  ): ActionRegistry;
  forSurface(surface: ActionSurface): AnyActionSpec[];
  get(id: string): AnyActionSpec | undefined;
  list(): AnyActionSpec[];
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
