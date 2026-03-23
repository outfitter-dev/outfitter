/* eslint-disable outfitter/max-file-lines -- Schema command wiring stays together so the introspection surface is easier to follow. */
/**
 * Commander command wiring for schema introspection.
 *
 * @internal
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { ActionSurface } from "@outfitter/contracts";
import {
  type ActionSource,
  diffSurfaceMaps,
  formatManifestMarkdown,
  type GenerateManifestOptions,
  generateManifest,
  generateSurfaceMap,
  hashSurfaceMap,
  readSurfaceLock,
  readSurfaceMap,
  resolveSnapshotPath,
  writeSurfaceLock,
  writeSurfaceMap,
} from "@outfitter/schema";
import { Command } from "commander";

import { formatManifestHuman } from "./schema-formatting.js";
import type { SchemaCommandOptions } from "./schema-types.js";

// =============================================================================
// Show Handler (shared by parent action and show subcommand)
// =============================================================================

function handleShow(
  source: ActionSource,
  programName: string | undefined,
  parentCmd: Command,
  actionArg: string | undefined,
  cmdOptions: {
    output?: string;
    surface?: string;
    pretty?: boolean;
  }
): void {
  const manifestOptions: GenerateManifestOptions = {};

  if (cmdOptions.surface) {
    (manifestOptions as { surface?: ActionSurface }).surface =
      cmdOptions.surface as ActionSurface;
  }

  const manifest = generateManifest(source, manifestOptions);

  if (cmdOptions.output === "json") {
    const indent = cmdOptions.pretty ? 2 : undefined;
    if (actionArg) {
      const entry = manifest.actions.find((a) => a.id === actionArg);
      if (!entry) {
        process.stderr.write(`Unknown action: ${actionArg}\n`);
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`${JSON.stringify(entry, null, indent)}\n`);
    } else {
      process.stdout.write(`${JSON.stringify(manifest, null, indent)}\n`);
    }
    return;
  }

  // Human output
  const resolvedName = programName ?? parentCmd.parent?.name() ?? undefined;
  const output = formatManifestHuman(manifest, resolvedName, actionArg);
  process.stdout.write(`${output}\n`);
}

// =============================================================================
// Commander Command
// =============================================================================

/**
 * Create a `schema` command for CLI introspection.
 *
 * When `options.surface` is provided, adds `generate` and `diff` subcommands
 * for surface map file I/O and drift detection.
 *
 * @param source - ActionRegistry or array of ActionSpec
 * @param options - Command configuration
 * @returns A Commander command instance
 */
export function createSchemaCommand(
  source: ActionSource,
  options?: SchemaCommandOptions
): Command {
  const cmd = new Command("schema")
    .description("Show CLI schema for machine or human consumption")
    .argument("[action]", "Show detail for a specific action")
    .option("--output <mode>", "Output mode (human, json)", "human")
    .option("--surface <name>", "Filter by surface (cli, mcp, api, server)")
    .option("--pretty", "Pretty-print JSON output")
    .action(
      (
        actionArg: string | undefined,
        cmdOptions: {
          output?: string;
          surface?: string;
          pretty?: boolean;
        }
      ) => {
        handleShow(source, options?.programName, cmd, actionArg, cmdOptions);
      }
    );

  // Add show subcommand (explicit alias for parent behavior)
  const showCmd = new Command("show")
    .description("Show schema for all actions or a specific action")
    .argument("[action]", "Show detail for a specific action")
    .option("--output <mode>", "Output mode (human, json)", "human")
    .option("--surface <name>", "Filter by surface (cli, mcp, api, server)")
    .option("--pretty", "Pretty-print JSON output")
    .action(
      (
        actionArg: string | undefined,
        cmdOptions: {
          output?: string;
          surface?: string;
          pretty?: boolean;
        }
      ) => {
        handleShow(source, options?.programName, cmd, actionArg, cmdOptions);
      }
    );
  cmd.addCommand(showCmd);

  // Add surface subcommands only when surface options are provided
  if (options?.surface) {
    const surfaceOpts = options.surface;
    const cwd = surfaceOpts.cwd ?? process.cwd();
    const outputDir = surfaceOpts.outputDir ?? ".outfitter";

    // generate subcommand
    const generateCmd = new Command("generate")
      .description("Generate surface map, write _surface.json and surface.lock")
      .option("--dry-run", "Print surface map without writing to disk")
      .option(
        "--snapshot <version>",
        "Write snapshot to .outfitter/snapshots/<version>.json"
      )
      .action(async (genOptions: { dryRun?: boolean; snapshot?: string }) => {
        const surfaceMap = generateSurfaceMap(source, {
          generator: "build",
        });

        if (genOptions.dryRun) {
          process.stdout.write(`${JSON.stringify(surfaceMap, null, 2)}\n`);
          return;
        }

        if (genOptions.snapshot) {
          const snapshotPath = resolveSnapshotPath(
            cwd,
            outputDir,
            genOptions.snapshot
          );
          await writeSurfaceMap(surfaceMap, snapshotPath);
          process.stdout.write(`Snapshot written to ${snapshotPath}\n`);
          return;
        }

        // Write the full surface map to _surface.json (gitignored)
        const detailPath = join(cwd, outputDir, "_surface.json");
        await writeSurfaceMap(surfaceMap, detailPath);

        // Write the content hash to surface.lock (committed)
        const hash = hashSurfaceMap(surfaceMap);
        const lockPath = join(cwd, outputDir, "surface.lock");
        await writeSurfaceLock(hash, lockPath);

        process.stdout.write(`Surface map written to ${detailPath}\n`);
      });
    cmd.addCommand(generateCmd);

    // diff subcommand
    const diffCmd = new Command("diff")
      .description("Compare runtime schema against committed surface.lock")
      .option("--output <mode>", "Output mode (human, json)", "human")
      .option("--against <version>", "Compare runtime against a named snapshot")
      .option("--from <version>", "Base snapshot for snapshot-to-snapshot diff")
      .option("--to <version>", "Target snapshot for snapshot-to-snapshot diff")
      .action(
        async (diffOptions: {
          output?: string;
          against?: string;
          from?: string;
          to?: string;
        }) => {
          let left: Awaited<ReturnType<typeof readSurfaceMap>>;
          let right: Awaited<ReturnType<typeof readSurfaceMap>>;
          let diffMode:
            | "committed-to-runtime"
            | "snapshot-to-runtime"
            | "snapshot-to-snapshot" = "committed-to-runtime";

          if (
            (diffOptions.from && !diffOptions.to) ||
            (!diffOptions.from && diffOptions.to)
          ) {
            process.stderr.write(
              "Both --from and --to are required for snapshot-to-snapshot diff.\n"
            );
            process.exitCode = 1;
            return;
          }

          if (diffOptions.from && diffOptions.to) {
            // Snapshot-to-snapshot: --from v1 --to v2
            diffMode = "snapshot-to-snapshot";
            const fromPath = resolveSnapshotPath(
              cwd,
              outputDir,
              diffOptions.from
            );
            const toPath = resolveSnapshotPath(cwd, outputDir, diffOptions.to);

            try {
              left = await readSurfaceMap(fromPath);
            } catch (err) {
              if ((err as NodeJS.ErrnoException).code === "ENOENT") {
                process.stderr.write(`No snapshot at ${fromPath}\n`);
              } else {
                process.stderr.write(
                  `Failed to read snapshot at ${fromPath}: ${err instanceof Error ? err.message : String(err)}\n`
                );
              }
              process.exitCode = 1;
              return;
            }

            try {
              right = await readSurfaceMap(toPath);
            } catch (err) {
              if ((err as NodeJS.ErrnoException).code === "ENOENT") {
                process.stderr.write(`No snapshot at ${toPath}\n`);
              } else {
                process.stderr.write(
                  `Failed to read snapshot at ${toPath}: ${err instanceof Error ? err.message : String(err)}\n`
                );
              }
              process.exitCode = 1;
              return;
            }
          } else if (diffOptions.against) {
            // Snapshot-to-runtime: --against v1
            diffMode = "snapshot-to-runtime";
            const snapshotPath = resolveSnapshotPath(
              cwd,
              outputDir,
              diffOptions.against
            );

            try {
              left = await readSurfaceMap(snapshotPath);
            } catch (err) {
              if ((err as NodeJS.ErrnoException).code === "ENOENT") {
                process.stderr.write(`No snapshot at ${snapshotPath}\n`);
              } else {
                process.stderr.write(
                  `Failed to read snapshot at ${snapshotPath}: ${err instanceof Error ? err.message : String(err)}\n`
                );
              }
              process.exitCode = 1;
              return;
            }

            right = generateSurfaceMap(source, { generator: "runtime" });
          } else {
            // Default: hash-based comparison via surface.lock
            const lockPath = join(cwd, outputDir, "surface.lock");
            const currentSurfaceMap = generateSurfaceMap(source, {
              generator: "runtime",
            });
            const currentHash = hashSurfaceMap(currentSurfaceMap);

            let committedHash: string | undefined;
            try {
              committedHash = await readSurfaceLock(lockPath);
            } catch (err) {
              if ((err as NodeJS.ErrnoException).code === "ENOENT") {
                process.stderr.write(
                  `No committed surface.lock at ${lockPath}\n`
                );
                process.stderr.write("Run 'schema generate' first.\n");
              } else {
                process.stderr.write(
                  `Failed to read surface.lock at ${lockPath}: ${err instanceof Error ? err.message : String(err)}\n`
                );
              }
              process.exitCode = 1;
              return;
            }

            // Fast path: hashes match, no drift
            if (committedHash === currentHash) {
              if (diffOptions.output === "json") {
                process.stdout.write(
                  `${JSON.stringify({ hasChanges: false, added: [], removed: [], modified: [], metadataChanges: [] }, null, 2)}\n`
                );
              } else {
                process.stdout.write("No schema drift detected.\n");
              }
              return;
            }

            // Hashes differ: fall through to semantic diff using _surface.json
            const detailPath = join(cwd, outputDir, "_surface.json");
            try {
              const candidate = await readSurfaceMap(detailPath);
              const candidateHash = hashSurfaceMap(candidate);
              if (candidateHash !== committedHash) {
                // _surface.json is stale — don't use it for semantic diff
                throw new Error("stale _surface.json");
              }
              left = candidate;
            } catch {
              // _surface.json may not exist yet (first run after migration).
              // Generate a build-mode map as the "committed" side so the
              // semantic diff still works — the hash mismatch already tells
              // us there is drift.
              left = generateSurfaceMap(source, { generator: "build" });
            }
            right = currentSurfaceMap;
          }

          const result = diffSurfaceMaps(left, right, { mode: diffMode });

          if (diffOptions.output === "json") {
            process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
          } else {
            if (!result.hasChanges) {
              process.stdout.write("No schema drift detected.\n");
              return;
            }

            const lines: string[] = [];
            lines.push("Schema drift detected:\n");

            if (result.added.length > 0) {
              lines.push("  Added:");
              for (const entry of result.added) {
                lines.push(`    + ${entry.id}`);
              }
            }

            if (result.removed.length > 0) {
              lines.push("  Removed:");
              for (const entry of result.removed) {
                lines.push(`    - ${entry.id}`);
              }
            }

            if (result.modified.length > 0) {
              lines.push("  Modified:");
              for (const entry of result.modified) {
                lines.push(`    ~ ${entry.id} (${entry.changes.join(", ")})`);
              }
            }

            if (result.metadataChanges.length > 0) {
              lines.push("  Metadata:");
              for (const field of result.metadataChanges) {
                lines.push(`    ~ ${field}`);
              }
            }

            process.stdout.write(`${lines.join("\n")}\n`);
          }

          if (result.hasChanges) {
            process.exitCode = 1;
          }
        }
      );
    cmd.addCommand(diffCmd);

    // docs subcommand
    const docsCmd = new Command("docs")
      .description("Generate markdown reference documentation")
      .option("--surface <name>", "Which surface to document (cli, mcp)", "mcp")
      .option(
        "--output-dir <dir>",
        "Directory to write the reference doc",
        "docs/reference"
      )
      .option("--dry-run", "Print to stdout instead of writing to disk")
      .action(
        async (docsOptions: {
          surface?: string;
          outputDir?: string;
          dryRun?: boolean;
        }) => {
          const surface = (docsOptions.surface ?? "mcp") as ActionSurface;
          if (surface !== "mcp" && surface !== "cli") {
            process.stderr.write(
              `Unsupported surface for docs: "${surface}". Use "mcp" or "cli".\n`
            );
            process.exitCode = 1;
            return;
          }
          const manifest = generateManifest(source, { surface });
          const markdown = formatManifestMarkdown(manifest, { surface });

          if (docsOptions.dryRun) {
            process.stdout.write(markdown);
            return;
          }

          const outDir = docsOptions.outputDir ?? "docs/reference";
          const outputPath = join(
            cwd,
            outDir,
            `${surface.toUpperCase()}_REFERENCE.md`
          );
          await mkdir(dirname(outputPath), { recursive: true });
          await writeFile(outputPath, markdown, "utf-8");
          process.stdout.write(`Reference written to ${outputPath}\n`);
        }
      );
    cmd.addCommand(docsCmd);
  }

  return cmd;
}
