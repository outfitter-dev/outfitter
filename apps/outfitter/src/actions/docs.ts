/**
 * Docs action definitions.
 *
 * @packageDocumentation
 */

import { cwdPreset } from "@outfitter/cli/flags";
import {
  jqPreset,
  outputModePreset,
  resolveOutputMode,
} from "@outfitter/cli/query";
import { defineAction, Result } from "@outfitter/contracts";
import { z } from "zod";

import {
  type DocsApiInput,
  printDocsApiResults,
  runDocsApi,
} from "../commands/docs-api.js";
import {
  type DocsExportInput,
  type DocsExportTarget,
  printDocsExportResults,
  runDocsExport,
} from "../commands/docs-export.js";
import { printDocsIndexResults, runDocsIndex } from "../commands/docs-index.js";
import { printDocsListResults, runDocsList } from "../commands/docs-list.js";
import {
  printDocsSearchResults,
  runDocsSearch,
} from "../commands/docs-search.js";
import { printDocsShowResults, runDocsShow } from "../commands/docs-show.js";
import type { CliOutputMode } from "../output-mode.js";
import { checkTsdocOutputSchema } from "./check.js";
import {
  outputModeSchema,
  resolveCwdFromPreset,
  resolveStringFlag,
} from "./shared.js";

interface DocsListActionInput {
  readonly cwd: string;
  readonly jq?: string | undefined;
  readonly kind?: string | undefined;
  readonly outputMode: CliOutputMode;
  readonly package?: string | undefined;
}

const docsListInputSchema: z.ZodType<DocsListActionInput> = z.object({
  cwd: z.string(),
  kind: z.string().optional(),
  package: z.string().optional(),
  jq: z.string().optional(),
  outputMode: outputModeSchema,
});

const docsListCwd = cwdPreset();
const docsListOutputMode = outputModePreset({ includeJsonl: true });
const docsListJq = jqPreset();

type DocsListAction = ReturnType<
  typeof defineAction<DocsListActionInput, unknown>
>;

/** List documentation entries from the workspace docs map. */
export const docsListAction: DocsListAction = defineAction({
  id: "docs.list",
  description: "List documentation entries from the docs map",
  surfaces: ["cli"],
  input: docsListInputSchema,
  cli: {
    group: "docs",
    command: "list",
    description: "List documentation entries from the docs map",
    options: [
      {
        flags: "-k, --kind <kind>",
        description:
          "Filter by doc kind (readme, guide, reference, architecture, release, convention, deep, generated)",
      },
      {
        flags: "-p, --package <name>",
        description: "Filter by package name",
      },
      ...docsListOutputMode.options,
      ...docsListJq.options,
      ...docsListCwd.options,
    ],
    mapInput: (context) => {
      const { jq } = docsListJq.resolve(context.flags);
      const { mode: outputMode } = resolveOutputMode(context.flags);
      const kind = resolveStringFlag(context.flags["kind"]);
      const pkg = resolveStringFlag(context.flags["package"]);

      return {
        cwd: resolveCwdFromPreset(context.flags, docsListCwd),
        outputMode,
        jq,
        ...(kind !== undefined ? { kind } : {}),
        ...(pkg !== undefined ? { package: pkg } : {}),
      };
    },
  },
  handler: async (input) => {
    const { outputMode, jq } = input;
    const result = await runDocsList(input);

    if (result.isErr()) {
      return result;
    }

    await printDocsListResults(result.value, { mode: outputMode, jq });
    return Result.ok(result.value);
  },
});

interface DocsShowActionInput {
  readonly cwd: string;
  readonly id: string;
  readonly jq?: string | undefined;
  readonly outputMode: CliOutputMode;
}

const docsShowInputSchema: z.ZodType<DocsShowActionInput> = z.object({
  id: z.string(),
  cwd: z.string(),
  jq: z.string().optional(),
  outputMode: outputModeSchema,
});

const docsShowCwd = cwdPreset();
const docsShowOutputMode = outputModePreset({ includeJsonl: true });
const docsShowJq = jqPreset();

type DocsShowAction = ReturnType<
  typeof defineAction<DocsShowActionInput, unknown>
>;

/** Show a specific documentation entry by ID, including its content. */
export const docsShowAction: DocsShowAction = defineAction({
  id: "docs.show",
  description: "Show a specific documentation entry and its content",
  surfaces: ["cli"],
  input: docsShowInputSchema,
  cli: {
    group: "docs",
    command: "show <id>",
    description: "Show a specific documentation entry and its content",
    options: [
      ...docsShowOutputMode.options,
      ...docsShowJq.options,
      ...docsShowCwd.options,
    ],
    mapInput: (context) => {
      const { jq } = docsShowJq.resolve(context.flags);
      const { mode: outputMode } = resolveOutputMode(context.flags);

      return {
        id: context.args[0] as string,
        cwd: resolveCwdFromPreset(context.flags, docsShowCwd),
        jq,
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const { outputMode, jq } = input;
    const result = await runDocsShow(input);

    if (result.isErr()) {
      return result;
    }

    await printDocsShowResults(result.value, { mode: outputMode, jq });
    return Result.ok(result.value);
  },
});

interface DocsSearchActionInput {
  readonly cwd: string;
  readonly indexPath?: string | undefined;
  readonly jq?: string | undefined;
  readonly limit?: number | undefined;
  readonly outputMode: CliOutputMode;
  readonly query: string;
}

const docsSearchInputSchema: z.ZodType<DocsSearchActionInput> = z.object({
  query: z.string(),
  cwd: z.string(),
  indexPath: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  jq: z.string().optional(),
  outputMode: outputModeSchema,
});

const docsSearchCwd = cwdPreset();
const docsSearchOutputMode = outputModePreset({ includeJsonl: true });
const docsSearchJq = jqPreset();

type DocsSearchAction = ReturnType<
  typeof defineAction<DocsSearchActionInput, unknown>
>;

/** Search documentation content using FTS5 BM25-ranked search. */
export const docsSearchAction: DocsSearchAction = defineAction({
  id: "docs.search",
  description:
    "Search documentation content using FTS5 BM25-ranked full-text search",
  surfaces: ["cli"],
  input: docsSearchInputSchema,
  cli: {
    group: "docs",
    command: "search <query>",
    description:
      "Search documentation content using FTS5 BM25-ranked full-text search",
    options: [
      {
        flags: "-l, --limit <count>",
        description: "Maximum number of results (default: 10)",
      },
      {
        flags: "--index-path <path>",
        description:
          "Path to the SQLite index file (default: workspace-scoped under ~/.outfitter/docs/)",
      },
      ...docsSearchOutputMode.options,
      ...docsSearchJq.options,
      ...docsSearchCwd.options,
    ],
    mapInput: (context) => {
      const { jq } = docsSearchJq.resolve(context.flags);
      const { mode: outputMode } = resolveOutputMode(context.flags);
      const limitRaw = context.flags["limit"];
      const limit =
        typeof limitRaw === "string"
          ? Number.parseInt(limitRaw, 10)
          : undefined;
      const indexPath = resolveStringFlag(context.flags["indexPath"]);

      return {
        query: context.args[0] as string,
        cwd: resolveCwdFromPreset(context.flags, docsSearchCwd),
        outputMode,
        jq,
        ...(typeof limitRaw === "string" ? { limit } : {}),
        ...(indexPath !== undefined ? { indexPath } : {}),
      };
    },
  },
  handler: async (input) => {
    const { outputMode, jq, ...searchInput } = input;
    const result = await runDocsSearch({ ...searchInput, outputMode, jq });

    if (result.isErr()) {
      return result;
    }

    await printDocsSearchResults(result.value, { mode: outputMode, jq });
    return Result.ok(result.value);
  },
});

const docsApiInputSchema = z.object({
  cwd: z.string(),
  level: z.enum(["documented", "partial", "undocumented"]).optional(),
  packages: z.array(z.string()),
  jq: z.string().optional(),
  outputMode: outputModeSchema,
});

const docsApiCwd = cwdPreset();
const docsApiOutputMode = outputModePreset({ includeJsonl: true });
const docsApiJq = jqPreset();

type DocsApiAction = ReturnType<typeof defineAction<DocsApiInput, unknown>>;

/** Extract API reference from TSDoc coverage data. */
export const docsApiAction: DocsApiAction = defineAction({
  id: "docs.api",
  description: "Extract API reference from TSDoc coverage data",
  surfaces: ["cli"],
  input: docsApiInputSchema,
  output: checkTsdocOutputSchema,
  cli: {
    group: "docs",
    command: "api",
    description: "Extract API reference from TSDoc coverage data",
    options: [
      {
        flags: "--level <level>",
        description:
          "Filter declarations by coverage level (undocumented, partial, documented)",
      },
      {
        flags: "--package <name>",
        description: "Filter to specific package(s) by name (repeatable)",
      },
      ...docsApiOutputMode.options,
      ...docsApiJq.options,
      ...docsApiCwd.options,
    ],
    mapInput: (context) => {
      const { jq } = docsApiJq.resolve(context.flags);
      const { mode: outputMode } = resolveOutputMode(context.flags);

      // Resolve --level flag
      const levelRaw = context.flags["level"];
      const validLevels = new Set(["documented", "partial", "undocumented"]);
      const level =
        typeof levelRaw === "string" && validLevels.has(levelRaw)
          ? (levelRaw as "documented" | "partial" | "undocumented")
          : undefined;

      // Resolve --package flag (Commander collects repeatable into array)
      const pkgRaw = context.flags["package"];
      let packages: string[] = [];
      if (Array.isArray(pkgRaw)) {
        packages = pkgRaw.filter((v): v is string => typeof v === "string");
      } else if (typeof pkgRaw === "string") {
        packages = [pkgRaw];
      }

      return {
        cwd: resolveCwdFromPreset(context.flags, docsApiCwd),
        outputMode,
        jq,
        level,
        packages,
      };
    },
  },
  handler: async (input) => {
    const { cwd, packages, level, outputMode, jq } = input;
    const result = await runDocsApi({
      cwd,
      packages,
      level,
      outputMode,
      jq,
    });

    if (result.isErr()) {
      return result;
    }

    await printDocsApiResults(result.value, { mode: outputMode, jq });
    return Result.ok(result.value);
  },
});

const docsExportTargetValues = [
  "packages",
  "llms",
  "llms-full",
  "all",
] as const;

const docsExportInputSchema = z.object({
  cwd: z.string(),
  target: z.enum(docsExportTargetValues).default("all"),
  outputMode: outputModeSchema,
});

const docsExportCwd = cwdPreset();
const docsExportOutputMode = outputModePreset({ includeJsonl: true });

type DocsExportAction = ReturnType<
  typeof defineAction<DocsExportInput, unknown>
>;

/** Export documentation to package READMEs, llms.txt, or both. */
export const docsExportAction: DocsExportAction = defineAction({
  id: "docs.export",
  description: "Export documentation to packages, llms.txt, or both",
  surfaces: ["cli"],
  input: docsExportInputSchema,
  cli: {
    group: "docs",
    command: "export",
    description: "Export documentation to packages, llms.txt, or both",
    options: [
      {
        flags: "-t, --target <target>",
        description:
          "Export target (packages|llms|llms-full|all, default: all)",
      },
      ...docsExportOutputMode.options,
      ...docsExportCwd.options,
    ],
    mapInput: (context) => {
      const { mode: outputMode } = resolveOutputMode(context.flags);
      const targetRaw = resolveStringFlag(context.flags["target"]);
      const target = (targetRaw ?? "all") as DocsExportTarget;

      return {
        cwd: resolveCwdFromPreset(context.flags, docsExportCwd),
        target,
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const { outputMode, ...exportInput } = input;
    const result = await runDocsExport({ ...exportInput, outputMode });

    if (result.isErr()) {
      return result;
    }

    await printDocsExportResults(result.value, { mode: outputMode });
    return Result.ok(result.value);
  },
});

interface DocsIndexActionInput {
  readonly cwd: string;
  readonly indexPath?: string | undefined;
  readonly outputMode: CliOutputMode;
}

const docsIndexInputSchema: z.ZodType<DocsIndexActionInput> = z.object({
  cwd: z.string(),
  indexPath: z.string().optional(),
  outputMode: outputModeSchema,
});

const docsIndexCwd = cwdPreset();
const docsIndexOutputMode = outputModePreset({ includeJsonl: true });

type DocsIndexAction = ReturnType<
  typeof defineAction<DocsIndexActionInput, unknown>
>;

/** Build an FTS5 search index from workspace documentation. */
export const docsIndexAction: DocsIndexAction = defineAction({
  id: "docs.index",
  description: "Build search index for workspace documentation",
  surfaces: ["cli"],
  input: docsIndexInputSchema,
  cli: {
    group: "docs",
    command: "index",
    description: "Build search index for workspace documentation",
    options: [
      {
        flags: "--index-path <path>",
        description:
          "Path to the SQLite index file (default: workspace-scoped under ~/.outfitter/docs/)",
      },
      ...docsIndexOutputMode.options,
      ...docsIndexCwd.options,
    ],
    mapInput: (context) => {
      const { mode: outputMode } = resolveOutputMode(context.flags);
      const indexPath = resolveStringFlag(context.flags["indexPath"]);

      return {
        cwd: resolveCwdFromPreset(context.flags, docsIndexCwd),
        outputMode,
        ...(indexPath !== undefined ? { indexPath } : {}),
      };
    },
  },
  handler: async (input) => {
    const { outputMode } = input;
    const result = await runDocsIndex(input);

    if (result.isErr()) {
      return result;
    }

    await printDocsIndexResults(result.value, { mode: outputMode });
    return Result.ok(result.value);
  },
});
