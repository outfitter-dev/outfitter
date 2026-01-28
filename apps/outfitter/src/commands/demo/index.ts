/**
 * Demo section registry.
 *
 * Exports available demo sections and a function to run them.
 *
 * @packageDocumentation
 */

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
 * Registry of all available demo sections.
 * Add new sections here as they are implemented.
 */
const sections: DemoSection[] = [];

/**
 * Registers a demo section.
 */
export function registerSection(section: DemoSection): void {
  sections.push(section);
}

/**
 * Gets all available section IDs.
 */
export function getSectionIds(): string[] {
  return sections.map((s) => s.id);
}

/**
 * Gets all available sections with their descriptions.
 */
export function getSections(): readonly DemoSection[] {
  return sections;
}

/**
 * Gets a section by ID.
 */
export function getSection(id: string): DemoSection | undefined {
  return sections.find((s) => s.id === id);
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
  for (const section of sections) {
    outputs.push(section.run());
    outputs.push(""); // Add blank line between sections
  }
  return outputs.join("\n").trimEnd();
}
