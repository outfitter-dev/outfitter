/**
 * Demo section registry.
 *
 * Integrates @outfitter/cli/demo primitives with app-specific sections.
 *
 * @packageDocumentation
 */

import {
  type DemoConfig,
  getPrimitive,
  getPrimitiveIds,
  type PrimitiveId,
  renderAllDemos,
  renderDemo,
} from "@outfitter/tui/demo";

/**
 * A demo section that can be executed.
 */
export interface DemoSection {
  /** Section identifier */
  readonly id: string;
  /** Human-readable description */
  readonly description: string;
  /** Execute the section and return output */
  readonly run: () => string;
}

/**
 * Registry of app-specific demo sections.
 * These are sections not covered by @outfitter/tui/demo.
 */
const appSections: DemoSection[] = [];

/**
 * Demo configuration for this CLI.
 */
const DEMO_CONFIG: DemoConfig = {
  examples: {
    success: "Package published",
    error: "Init failed",
    warning: "Deprecated API",
    spinnerMessage: "Installing dependencies...",
    boxTitle: "Outfitter",
    boxContent: "CLI scaffolding tool",
  },
};

/**
 * Registers an app-specific demo section.
 */
export function registerSection(section: DemoSection): void {
  appSections.push(section);
}

/**
 * Gets all available section IDs (primitives + app sections).
 */
export function getSectionIds(): string[] {
  const primitiveIds = getPrimitiveIds();
  const appIds = appSections.map((s) => s.id);
  return [...primitiveIds, ...appIds];
}

/**
 * Gets all available sections with their descriptions.
 */
export function getSections(): readonly DemoSection[] {
  // Convert primitives to DemoSection format
  const primitiveSections: DemoSection[] = getPrimitiveIds().map((id) => {
    const meta = getPrimitive(id);
    return {
      id: meta.id,
      description: meta.description,
      run: () => renderDemo(id, DEMO_CONFIG),
    };
  });

  return [...primitiveSections, ...appSections];
}

/**
 * Gets a section by ID.
 */
export function getSection(id: string): DemoSection | undefined {
  // Check if it's a primitive
  const primitiveIds = getPrimitiveIds();
  if (primitiveIds.includes(id as PrimitiveId)) {
    const meta = getPrimitive(id as PrimitiveId);
    return {
      id: meta.id,
      description: meta.description,
      run: () => renderDemo(id as PrimitiveId, DEMO_CONFIG),
    };
  }

  // Check app sections
  return appSections.find((s) => s.id === id);
}

/**
 * Runs a specific section by ID.
 * @returns The section output, or undefined if section not found
 */
export function runSection(id: string): string | undefined {
  const section = getSection(id);
  if (!section) {
    return undefined;
  }
  return section.run();
}

/**
 * Runs all sections in order.
 * @returns Combined output from all sections
 */
export function runAllSections(): string {
  const outputs: string[] = [];

  // Run all primitive demos
  outputs.push(renderAllDemos(DEMO_CONFIG));

  // Run app-specific sections
  for (const section of appSections) {
    outputs.push("");
    outputs.push(section.run());
  }

  return outputs.join("\n").trimEnd();
}
