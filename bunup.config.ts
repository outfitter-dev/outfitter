import type { BunupPlugin } from "bunup";
import { defineWorkspace } from "bunup";

/**
 * Determines whether a built JavaScript file is an invalid bare export stub.
 *
 * These files contain only `export { ... };` without top-level declarations or
 * imports for those bindings, which breaks runtime parsing. Some variants also
 * include side-effect-only imports before the broken export block.
 */
function isBareExportStub(content: string): boolean {
  const normalized = content
    .replace(/\r\n/g, "\n")
    .replace(/^\s*\/\/.*\n/gm, "")
    .trim();

  return /^(?:import\s*["'][^"']+["'];\s*)*export\s*\{[\s\S]*\};$/.test(
    normalized
  );
}

/**
 * Resolves the source TypeScript file path from a built JavaScript file path.
 *
 * For example:
 * - `packages/cli/dist/index.js` -> `packages/cli/src/index.ts`
 */
function resolveSourcePath(fullPath: string): string {
  return fullPath.replace("/dist/", "/src/").replace(/\.js$/, ".ts");
}

/**
 * Resolve the package root from a built artifact path.
 *
 * For example:
 * - `packages/mcp/dist/shared/@outfitter/mcp-abc123.js` -> `packages/mcp`
 */
function resolvePackageRootFromDistPath(fullPath: string): string | null {
  const distIndex = fullPath.indexOf("/dist/");
  if (distIndex === -1) {
    return null;
  }
  return fullPath.slice(0, distIndex);
}

/**
 * Extract runtime export specifiers from a mixed `export { ... } from "..."` block.
 *
 * Type-only specifiers are removed so generated JavaScript remains valid.
 */
function toRuntimeSpecifiers(specifierBlock: string): string[] {
  const withoutBlockComments = specifierBlock.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLineComments = withoutBlockComments.replace(/\/\/.*$/gm, "");
  const rawSpecifiers = withoutLineComments
    .split(",")
    .map((specifier) => specifier.trim())
    .filter(Boolean);

  return rawSpecifiers
    .filter((specifier) => !specifier.startsWith("type "))
    .map((specifier) => specifier.replace(/\s+/g, " "));
}

/**
 * Extract sorted runtime export binding names from a bare `export { ... };` stub.
 *
 * For aliased exports (`foo as bar`), the exported name (`bar`) is used.
 */
function parseBareStubBindings(content: string): string[] {
  const match = content.match(/export\s*\{([\s\S]*?)\};/);
  const specifierBlock = match?.[1];
  if (!specifierBlock) {
    return [];
  }

  const bindings = toRuntimeSpecifiers(specifierBlock)
    .map((specifier) => {
      const aliasMatch = specifier.match(
        /^([A-Za-z_$][\w$]*|default)\s+as\s+([A-Za-z_$][\w$]*)$/
      );
      return aliasMatch ? aliasMatch[2] : specifier;
    })
    .map((binding) => binding.trim())
    .filter((binding) => binding.length > 0);

  return [...new Set(bindings)].toSorted();
}

/**
 * Extract sorted runtime named export bindings from source `export { ... } from`.
 *
 * Star exports are intentionally skipped because they do not expose explicit
 * binding names required for deterministic matching.
 */
function extractRuntimeNamedExports(sourceContent: string): string[] {
  const exportFromPattern =
    /export\s+(type\s+)?(\*\s*(?:as\s+[A-Za-z_$][\w$]*)?|\{[\s\S]*?\})\s+from\s+["']([^"']+)["'];/g;
  const bindings: string[] = [];

  for (const match of sourceContent.matchAll(exportFromPattern)) {
    const typeModifier = match[1];
    const clause = match[2];
    if (!clause || typeModifier) {
      continue;
    }

    const trimmedClause = clause.trim();
    if (trimmedClause.startsWith("*")) {
      continue;
    }

    const specifierBlock = trimmedClause.slice(1, -1);
    for (const specifier of toRuntimeSpecifiers(specifierBlock)) {
      const aliasMatch = specifier.match(
        /^([A-Za-z_$][\w$]*|default)\s+as\s+([A-Za-z_$][\w$]*)$/
      );
      bindings.push(aliasMatch ? aliasMatch[2] : specifier);
    }
  }

  return [...new Set(bindings)].toSorted();
}

/**
 * Determine whether a module is a pure re-export barrel.
 *
 * Pure barrel modules contain only side-effect imports and `export ... from`
 * statements (plus comments/whitespace).
 */
function isPureReexportModule(sourceContent: string): boolean {
  const withoutBlockComments = sourceContent.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLineComments = withoutBlockComments.replace(/\/\/.*$/gm, "");
  const normalized = withoutLineComments.trim();

  if (normalized.length === 0) {
    return false;
  }

  return /^(?:import\s*["'][^"']+["'];\s*)*(?:export\s+(?:type\s+)?(?:\*\s*(?:as\s+[A-Za-z_$][\w$]*)?|\{[\s\S]*?\})\s+from\s+["'][^"']+["'];\s*)+$/.test(
    normalized
  );
}

/**
 * Resolve a source barrel path for hashed shared chunks by matching export bindings.
 *
 * This is a fallback when `dist -> src` path translation cannot find a source
 * file (for example `dist/shared/@outfitter/*.js` chunks).
 */
async function findSourcePathByRuntimeBindings(
  fullPath: string,
  builtContent: string
): Promise<string | null> {
  const packageRoot = resolvePackageRootFromDistPath(fullPath);
  if (!packageRoot) {
    return null;
  }

  const targetBindings = parseBareStubBindings(builtContent);
  if (targetBindings.length === 0) {
    return null;
  }

  const targetKey = targetBindings.join("|");
  let matchedPath: string | null = null;

  for await (const sourceRelativePath of new Bun.Glob("src/**/*.ts").scan(
    packageRoot
  )) {
    const sourcePath = `${packageRoot}/${sourceRelativePath}`;
    const sourceContent = await Bun.file(sourcePath).text();
    const sourceBindings = extractRuntimeNamedExports(sourceContent);
    if (sourceBindings.length === 0) {
      continue;
    }
    if (sourceBindings.join("|") !== targetKey) {
      continue;
    }
    if (matchedPath && matchedPath !== sourcePath) {
      return null;
    }
    matchedPath = sourcePath;
  }

  return matchedPath;
}

/**
 * Build runtime re-export statements from a source barrel module.
 *
 * Supports:
 * - `export { ... } from "..."` (dropping type-only exports)
 * - `export * from "..."` and `export * as name from "..."`
 */
function buildRuntimeReexports(sourceContent: string): string[] {
  const lines: string[] = [];
  const exportFromPattern =
    /export\s+(type\s+)?(\*\s*(?:as\s+[A-Za-z_$][\w$]*)?|\{[\s\S]*?\})\s+from\s+["']([^"']+)["'];/g;

  for (const match of sourceContent.matchAll(exportFromPattern)) {
    const typeModifier = match[1];
    const clause = match[2];
    const modulePath = match[3];

    if (!clause || !modulePath || typeModifier) {
      continue;
    }

    const trimmedClause = clause.trim();
    if (trimmedClause.startsWith("*")) {
      lines.push(`export ${trimmedClause} from "${modulePath}";`);
      continue;
    }

    const specifierBlock = trimmedClause.slice(1, -1);
    const runtimeSpecifiers = toRuntimeSpecifiers(specifierBlock);
    if (runtimeSpecifiers.length === 0) {
      continue;
    }

    lines.push(
      `export { ${runtimeSpecifiers.join(", ")} } from "${modulePath}";`
    );
  }

  return lines;
}

/**
 * Work around Bun duplicate export bug with re-exported entrypoints.
 * Removes duplicate export statements that appear consecutively.
 */
const stripDuplicateExports = (): BunupPlugin => ({
  name: "strip-duplicate-exports",
  hooks: {
    onBuildDone: async ({ files }) => {
      const exportRegex = /export\s*\{\s*([^}]+)\s*\};/g;

      for (const file of files) {
        if (file.dts) continue;
        if (!file.fullPath.endsWith(".js")) continue;

        const content = await Bun.file(file.fullPath).text();
        const matches = [...content.matchAll(exportRegex)];
        if (matches.length < 2) continue;

        const exports = matches.map((match) => {
          const start = match.index ?? 0;
          const end = start + match[0].length;
          const specifiers = match[1]
            .split(",")
            .map((specifier) => specifier.trim())
            .filter(Boolean)
            .toSorted()
            .join(",");
          return { start, end, specifiers };
        });

        const removals: Array<{ start: number; end: number }> = [];
        for (let i = 0; i < exports.length - 1; i += 1) {
          const current = exports[i];
          const next = exports[i + 1];
          const between = content.slice(current.end, next.start);

          if (between.trim() === "" && current.specifiers === next.specifiers) {
            removals.push({ start: current.end, end: next.end });
            i += 1;
          }
        }

        if (removals.length === 0) continue;

        let nextContent = content;
        for (let i = removals.length - 1; i >= 0; i -= 1) {
          const { start, end } = removals[i];
          nextContent = `${nextContent.slice(0, start)}${nextContent.slice(end)}`;
        }

        if (nextContent !== content) {
          await Bun.write(file.fullPath, nextContent);
        }
      }
    },
  },
});

/**
 * Repairs invalid bare export stubs emitted for barrel entrypoints.
 *
 * Some generated files contain only `export { ... };` with no declarations or
 * imports, which fails parsing. This plugin reconstructs runtime re-export
 * statements from the corresponding source barrel file.
 */
const repairBareBarrelExports = (): BunupPlugin => ({
  name: "repair-bare-barrel-exports",
  hooks: {
    onBuildDone: async ({ files }) => {
      for (const file of files) {
        if (file.dts || !file.fullPath.endsWith(".js")) continue;

        const builtContent = await Bun.file(file.fullPath).text();

        const directSourcePath = resolveSourcePath(file.fullPath);
        const directSourceFile = Bun.file(directSourcePath);
        if (await directSourceFile.exists()) {
          const sourceContent = await directSourceFile.text();
          if (!isPureReexportModule(sourceContent)) {
            continue;
          }

          const reexports = buildRuntimeReexports(sourceContent);
          if (reexports.length === 0) {
            continue;
          }

          const nextContent = `${reexports.join("\n")}\n`;
          if (nextContent !== builtContent) {
            await Bun.write(file.fullPath, nextContent);
          }

          continue;
        }

        if (!isBareExportStub(builtContent)) continue;

        const matchedSourcePath = await findSourcePathByRuntimeBindings(
          file.fullPath,
          builtContent
        );
        if (!matchedSourcePath) continue;

        const sourceFile = Bun.file(matchedSourcePath);
        const sourceContent = await sourceFile.text();
        const reexports = buildRuntimeReexports(sourceContent);
        if (reexports.length === 0) continue;

        const nextContent = `${reexports.join("\n")}\n`;
        if (nextContent !== builtContent) {
          await Bun.write(file.fullPath, nextContent);
        }
      }
    },
  },
});

/**
 * Bunup workspace configuration for tree-shakeable library builds.
 *
 * All library packages use shared options:
 * - ESM format (Bun-native consumers)
 * - Code splitting for optimal chunking
 * - DTS with splitting for type declarations
 * - Auto-generated package.json exports
 * - Bun as target runtime
 *
 * @see https://bunup.dev/docs/guide/workspaces
 */
export default defineWorkspace(
  [
    {
      name: "@outfitter/types",
      root: "packages/types",
      // Prevent future internal utilities from leaking into the public API.
      // All current source files are intentional exports.
      config: {
        exports: {
          exclude: ["./internal", "./internal/*"],
        },
      },
    },
    {
      name: "@outfitter/agents",
      root: "packages/agents",
    },
    {
      name: "@outfitter/contracts",
      root: "packages/contracts",
      // Prevent future internal utilities from leaking into the public API.
      // All current source files (including assert/ and result/) are intentional exports.
      config: {
        exports: {
          exclude: ["./internal", "./internal/*"],
        },
      },
    },
    {
      name: "@outfitter/config",
      root: "packages/config",
    },
    {
      name: "@outfitter/docs",
      root: "packages/docs",
      // Publish a stable top-level API from src/index.ts and ./core subpath.
      // Internal command modules and the CLI shim are not public imports.
      config: {
        exports: {
          exclude: [
            "./cli",
            "./command/*",
            "./commands/*",
            // Internal core helpers from modularization passes are intentionally
            // private; keep only the stable docs-map/public core entrypoints.
            "./core/content-processing",
            "./core/drift",
            "./core/errors",
            "./core/expected-output",
            "./core/llms-render",
            "./core/options",
            "./core/path-utils",
            "./core/sentinel-sync",
            "./core/types",
            "./version",
          ],
        },
      },
    },
    {
      name: "@outfitter/cli",
      root: "packages/cli",
      // Exclude internal exports
      config: {
        exports: {
          exclude: ["./colors/colors"],
        },
      },
    },
    {
      name: "@outfitter/tui",
      root: "packages/tui",
      // Exclude internal exports - consumers should use barrel exports (./render, ./demo)
      config: {
        exports: {
          exclude: [
            "./demo/renderers/*",
            "./demo/registry",
            "./demo/templates",
            "./demo/types",
            "./render/*",
          ],
        },
      },
    },
    {
      name: "@outfitter/daemon",
      root: "packages/daemon",
    },
    {
      name: "@outfitter/file-ops",
      root: "packages/file-ops",
    },
    {
      name: "@outfitter/index",
      root: "packages/index",
    },
    {
      name: "@outfitter/logging",
      root: "packages/logging",
    },
    {
      name: "@outfitter/mcp",
      root: "packages/mcp",
    },
    {
      name: "@outfitter/schema",
      root: "packages/schema",
    },
    {
      name: "@outfitter/state",
      root: "packages/state",
    },
    {
      name: "@outfitter/presets",
      root: "packages/presets",
    },
    {
      name: "@outfitter/oxlint-plugin",
      root: "packages/oxlint-plugin",
      config: {
        exports: {
          exclude: ["./rules", "./rules/*"],
        },
      },
    },
    {
      name: "@outfitter/testing",
      root: "packages/testing",
    },
    {
      name: "@outfitter/tooling",
      root: "packages/tooling",
      // CLI scripts and internal registry modules are not public API.
      // Public surface: ".", "./cli/check", "./cli/fix", "./cli/init", "./registry"
      config: {
        exports: {
          exclude: [
            "./cli/check-bunup-registry",
            "./cli/check-boundary-invocations",
            "./cli/check-changeset",
            "./cli/check-clean-tree",
            "./cli/check-exports",
            "./cli/check-readme-imports",
            "./cli/pre-push",
            "./cli/upgrade-bun",
            "./registry/build",
            "./registry/schema",
            "./version",
          ],
          customExports: {
            "./tsconfig.preset.json": "./tsconfig.preset.json",
            "./tsconfig.preset.bun.json": "./tsconfig.preset.bun.json",
            "./lefthook.yml": "./lefthook.yml",
          },
        },
      },
    },
    {
      name: "outfitter",
      root: "apps/outfitter",
      // Prevent internal utilities from leaking into the public API.
      // Current exports cover all command, engine, and create subpaths.
      config: {
        exports: {
          exclude: ["./actions/*", "./internal/*", "./output-mode"],
        },
      },
    },
    {
      name: "outfitter-cli-demo",
      root: "apps/cli-demo",
      config: {
        exports: {
          exclude: ["./internal/*"],
        },
      },
    },
  ],
  {
    // Entry points: all source files except tests
    entry: ["src/**/*.ts", "!src/**/*.test.ts", "!src/**/__tests__/**"],
    // Source base for correct output structure (strips src/ prefix)
    sourceBase: "./src",
    // Output format: ESM only (Bun ecosystem)
    format: ["esm"],
    // Work around Bun duplicate export bug with re-exported entrypoints and
    // repair invalid bare barrel stubs for runtime parsing.
    plugins: [stripDuplicateExports(), repairBareBarrelExports()],
    // TypeScript declarations with splitting
    dts: { splitting: true },
    // Auto-generate package.json exports field
    exports: true,
    // Code splitting for optimal tree-shaking
    splitting: true,
    // Clean dist before build
    clean: true,
    // Target Bun runtime
    target: "bun",
  }
);
