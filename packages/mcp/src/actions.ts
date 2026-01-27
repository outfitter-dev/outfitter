import type {
  ActionRegistry,
  ActionSurface,
  AnyActionSpec,
} from "@outfitter/contracts";
import { DEFAULT_REGISTRY_SURFACES } from "@outfitter/contracts";
import { defineTool } from "./server.js";
import type { ToolDefinition } from "./types.js";

export interface BuildMcpToolsOptions {
  readonly includeSurfaces?: readonly ActionSurface[];
}

type ActionSource = ActionRegistry | readonly AnyActionSpec[];

function isActionRegistry(source: ActionSource): source is ActionRegistry {
  return "list" in source;
}

export function buildMcpTools(
  source: ActionSource,
  options: BuildMcpToolsOptions = {}
): ToolDefinition<unknown, unknown>[] {
  const actions = isActionRegistry(source) ? source.list() : source;
  const includeSurfaces: readonly ActionSurface[] = options.includeSurfaces ?? [
    "mcp",
  ];

  return actions
    .filter((action) => {
      const surfaces: readonly ActionSurface[] =
        action.surfaces ?? DEFAULT_REGISTRY_SURFACES;
      return surfaces.some((surface) => includeSurfaces.includes(surface));
    })
    .map((action) =>
      defineTool({
        name: action.mcp?.tool ?? action.id,
        description: action.mcp?.description ?? action.description ?? action.id,
        inputSchema: action.input,
        handler: async (input, ctx) => action.handler(input, ctx),
        ...(action.mcp?.deferLoading !== undefined
          ? { deferLoading: action.mcp.deferLoading }
          : {}),
      })
    );
}
