import { relative } from "node:path";
import { output } from "@outfitter/cli/output";
import type { OutputMode } from "@outfitter/cli/types";
import type { Operation, OperationCollector } from "./collector.js";

export async function renderOperationPlan(
  collector: OperationCollector,
  options?: { readonly mode?: OutputMode; readonly rootDir?: string }
): Promise<void> {
  let mode = options?.mode;
  if (!mode) {
    if (process.env["OUTFITTER_JSONL"] === "1") {
      mode = "jsonl";
    } else if (process.env["OUTFITTER_JSON"] === "1") {
      mode = "json";
    }
  }
  if (mode === "json" || mode === "jsonl") {
    await output(collector.toJSON(), { mode });
    return;
  }

  const rootDir = options?.rootDir ?? process.cwd();
  const operations = collector.getOperations();
  const lines: string[] = ["[dry-run] Operation plan:", ""];

  const fileCreates = operations.filter(
    (op): op is Extract<Operation, { type: "file-create" }> =>
      op.type === "file-create"
  );
  const fileOverwrites = operations.filter(
    (op): op is Extract<Operation, { type: "file-overwrite" }> =>
      op.type === "file-overwrite"
  );
  const fileSkips = operations.filter(
    (op): op is Extract<Operation, { type: "file-skip" }> =>
      op.type === "file-skip"
  );
  const dirCreates = operations.filter(
    (op): op is Extract<Operation, { type: "dir-create" }> =>
      op.type === "dir-create"
  );
  const blockAdds = operations.filter(
    (op): op is Extract<Operation, { type: "block-add" }> =>
      op.type === "block-add"
  );
  const depAdds = operations.filter(
    (op): op is Extract<Operation, { type: "dependency-add" }> =>
      op.type === "dependency-add"
  );
  const configInjects = operations.filter(
    (op): op is Extract<Operation, { type: "config-inject" }> =>
      op.type === "config-inject"
  );
  const installOps = operations.filter(
    (op): op is Extract<Operation, { type: "install" }> => op.type === "install"
  );
  const gitOps = operations.filter(
    (op): op is Extract<Operation, { type: "git" }> => op.type === "git"
  );

  if (fileCreates.length > 0) {
    lines.push(`Create ${fileCreates.length} file(s):`);
    for (const op of fileCreates) {
      lines.push(`  + ${relative(rootDir, op.path)}`);
    }
    lines.push("");
  }

  if (fileOverwrites.length > 0) {
    lines.push(`Overwrite ${fileOverwrites.length} file(s):`);
    for (const op of fileOverwrites) {
      lines.push(`  ~ ${relative(rootDir, op.path)}`);
    }
    lines.push("");
  }

  if (fileSkips.length > 0) {
    lines.push(`Skip ${fileSkips.length} file(s):`);
    for (const op of fileSkips) {
      lines.push(`  - ${relative(rootDir, op.path)} (${op.reason})`);
    }
    lines.push("");
  }

  if (dirCreates.length > 0) {
    lines.push(`Create ${dirCreates.length} directory(ies):`);
    for (const op of dirCreates) {
      lines.push(`  + ${relative(rootDir, op.path)}/`);
    }
    lines.push("");
  }

  if (depAdds.length > 0) {
    lines.push(`Add ${depAdds.length} dependency(ies):`);
    for (const dep of depAdds) {
      const suffix = dep.section === "devDependencies" ? " (dev)" : "";
      lines.push(`  + ${dep.name}@${dep.version}${suffix}`);
    }
    lines.push("");
  }

  if (blockAdds.length > 0) {
    lines.push(`Add ${blockAdds.length} block(s):`);
    for (const block of blockAdds) {
      lines.push(`  + ${block.name}`);
    }
    lines.push("");
  }

  if (configInjects.length > 0) {
    lines.push(`Config injections (${configInjects.length}):`);
    for (const op of configInjects) {
      lines.push(`  ~ ${relative(rootDir, op.target)} (${op.description})`);
    }
    lines.push("");
  }

  if (installOps.length > 0 || gitOps.length > 0) {
    lines.push("Post-scaffold:");
    for (const op of installOps) {
      lines.push(`  $ ${op.command}`);
    }
    for (const op of gitOps) {
      if (op.action === "init") {
        lines.push("  $ git init");
      } else if (op.action === "add-all") {
        lines.push("  $ git add .");
      } else {
        lines.push(`  $ git commit -m "${op.message ?? ""}"`);
      }
    }
    lines.push("");
  }

  const summary = collector.countByType();
  lines.push(
    `Total operations: ${Object.values(summary).reduce((a, b) => a + b, 0)}`
  );
  await output(lines);
}
