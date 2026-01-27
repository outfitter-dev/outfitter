/**
 * @outfitter/contracts - Capability manifest
 *
 * Shared action capability manifest for CLI/MCP/API/server parity.
 *
 * @packageDocumentation
 */

export const CAPABILITY_SURFACES = ["cli", "mcp", "api", "server"] as const;

export type CapabilitySurface = (typeof CAPABILITY_SURFACES)[number];

export interface ActionCapability {
  surfaces: readonly CapabilitySurface[];
  notes?: string;
}

export const DEFAULT_ACTION_SURFACES = ["cli", "mcp"] as const;

export function capability(
  surfaces: readonly CapabilitySurface[] = DEFAULT_ACTION_SURFACES,
  notes?: string
): ActionCapability {
  return notes ? { surfaces, notes } : { surfaces };
}

export function capabilityAll(notes?: string): ActionCapability {
  return capability(CAPABILITY_SURFACES, notes);
}

export const ACTION_CAPABILITIES: Record<string, ActionCapability> = {
  // Navigation
  navigate: capability(),
  back: capability(),
  forward: capability(),
  reload: capability(),
  // Tabs
  tab: capability(),
  tabs: capability(),
  newTab: capability(),
  closeTab: capability(),
  // Interaction
  click: capability(),
  type: capability(),
  select: capability(),
  hover: capability(),
  focus: capability(["mcp"]),
  scroll: capability(),
  press: capability(),
  fill: capability(),
  find: capability(),
  check: capability(),
  uncheck: capability(),
  upload: capability(),
  download: capability(["server"], "Server-only for now"),
  dialog: capability(),
  // Wait
  waitFor: capability(["mcp"]),
  waitForNavigation: capability(["mcp"]),
  wait: capability(["mcp"]),
  // Capture
  snap: capability(),
  screenshot: capability(),
  html: capability(["mcp"]),
  text: capability(["mcp"]),
  // Markers
  marker: capability(),
  markers: capability(),
  markerGet: capability(),
  markerRead: capability(["mcp"]),
  markerCompare: capability(),
  markerDelete: capability(),
  markerResolve: capability(["cli"], "CLI-only for now"),
  // Display
  viewport: capability(),
  colorScheme: capability(),
  mode: capability(["mcp"]),
  // Evaluate
  evaluate: capability(["mcp"]),
  // Session
  session: capability(),
  sessions: capability(["mcp"]),
  steps: capability(),
};

export function getActionsForSurface(surface: CapabilitySurface): string[] {
  return Object.entries(ACTION_CAPABILITIES)
    .filter(([, capability]) => capability.surfaces.includes(surface))
    .map(([action]) => action);
}
