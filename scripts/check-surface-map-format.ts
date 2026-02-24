import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface SurfaceMapFormatCheckResult {
  readonly actual: string;
  readonly expected: string;
  readonly filePath: string;
  readonly ok: boolean;
}

export function canonicalizeJson(content: string): string {
  const parsed = JSON.parse(content) as unknown;
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

export function checkSurfaceMapFormat(
  content: string,
  filePath: string
): SurfaceMapFormatCheckResult {
  const expected = canonicalizeJson(content);

  return {
    filePath,
    actual: content,
    expected,
    ok: content === expected,
  };
}

function run(): void {
  const filePath = resolve(process.cwd(), ".outfitter", "surface.json");
  if (!existsSync(filePath)) {
    console.error(
      `[surface-map-format] Missing ${filePath}\nRun 'bun run apps/outfitter/src/cli.ts schema generate' from repo root.`
    );
    process.exit(1);
    return;
  }

  const content = readFileSync(filePath, "utf-8");
  const result = checkSurfaceMapFormat(content, filePath);
  if (result.ok) {
    console.log(
      `[surface-map-format] ${filePath} matches canonical formatting`
    );
    return;
  }

  console.error(
    [
      `[surface-map-format] ${filePath} is not canonically formatted.`,
      "Run 'bun run apps/outfitter/src/cli.ts schema generate' from repo root to rewrite .outfitter/surface.json.",
    ].join("\n")
  );
  process.exit(1);
}

if (import.meta.main) {
  run();
}
