/**
 * Docs action definitions.
 *
 * @packageDocumentation
 */

import { cwdPreset } from "@outfitter/cli/flags";
import { jqPreset, outputModePreset } from "@outfitter/cli/query";
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
import {
  type DocsListInput,
  printDocsListResults,
  runDocsList,
} from "../commands/docs-list.js";
import {
  type DocsSearchInput,
  printDocsSearchResults,
  runDocsSearch,
} from "../commands/docs-search.js";
import {
  type DocsShowInput,
  printDocsShowResults,
  runDocsShow,
} from "../commands/docs-show.js";
import { checkTsdocOutputSchema } from "./check.js";
import { resolveDocsOutputMode } from "./docs-output-mode.js";
import {
  outputModeSchema,
  resolveCwdFromPreset,
  resolveStringFlag,
} from "./shared.js";

const docsListInputSchema = z.object({
  cwd: z.string(),
  kind: z.string().optional(),
  package: z.string().optional(),
  jq: z.string().optional(),
  outputMode: outputModeSchema,
});

const docsListCwd = cwdPreset();
const docsListOutputMode = outputModePreset({ includeJsonl: true });
const docsListJq = jqPreset();

type DocsListAction = ReturnType<typeof defineAction<DocsListInput, unknown>>;

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
      const { outputMode: presetOutputMode } = docsListOutputMode.resolve(
        context.flags
      );
      const { jq } = docsListJq.resolve(context.flags);
      const outputMode = resolveDocsOutputMode(context.flags, presetOutputMode);
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

const docsShowInputSchema = z.object({
  id: z.string(),
  cwd: z.string(),
  jq: z.string().optional(),
  outputMode: outputModeSchema,
});

const docsShowCwd = cwdPreset();
const docsShowOutputMode = outputModePreset({ includeJsonl: true });
const docsShowJq = jqPreset();

type DocsShowAction = ReturnType<typeof defineAction<DocsShowInput, unknown>>;

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
      const { outputMode: presetOutputMode } = docsShowOutputMode.resolve(
        context.flags
      );
      const { jq } = docsShowJq.resolve(context.flags);
      const outputMode = resolveDocsOutputMode(context.flags, presetOutputMode);

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

const docsSearchInputSchema = z.object({
  query: z.string(),
  cwd: z.string(),
  kind: z.string().optional(),
  package: z.string().optional(),
  jq: z.string().optional(),
  outputMode: outputModeSchema,
});

const docsSearchCwd = cwdPreset();
const docsSearchOutputMode = outputModePreset({ includeJsonl: true });
const docsSearchJq = jqPreset();

type DocsSearchAction = ReturnType<
  typeof defineAction<DocsSearchInput, unknown>
>;

/** Search documentation content for a query string. */
export const docsSearchAction: DocsSearchAction = defineAction({
  id: "docs.search",
  description: "Search documentation content for a query string",
  surfaces: ["cli"],
  input: docsSearchInputSchema,
  cli: {
    group: "docs",
    command: "search <query>",
    description: "Search documentation content for a query string",
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
      ...docsSearchOutputMode.options,
      ...docsSearchJq.options,
      ...docsSearchCwd.options,
    ],
    mapInput: (context) => {
      const { outputMode: presetOutputMode } = docsSearchOutputMode.resolve(
        context.flags
      );
      const { jq } = docsSearchJq.resolve(context.flags);
      const outputMode = resolveDocsOutputMode(context.flags, presetOutputMode);
      const kind = resolveStringFlag(context.flags["kind"]);
      const pkg = resolveStringFlag(context.flags["package"]);

      return {
        query: context.args[0] as string,
        cwd: resolveCwdFromPreset(context.flags, docsSearchCwd),
        outputMode,
        jq,
        ...(kind !== undefined ? { kind } : {}),
        ...(pkg !== undefined ? { package: pkg } : {}),
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
      const { outputMode: presetOutputMode } = docsApiOutputMode.resolve(
        context.flags
      );
      const { jq } = docsApiJq.resolve(context.flags);
      const outputMode = resolveDocsOutputMode(context.flags, presetOutputMode);

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
      const { outputMode: presetOutputMode } = docsExportOutputMode.resolve(
        context.flags
      );
      const outputMode = resolveDocsOutputMode(context.flags, presetOutputMode);
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
