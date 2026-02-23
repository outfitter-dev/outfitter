import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  generatePackageListSection,
  replaceSentinelSection,
} from "../packages/docs/src/core/sentinel-generator.js";

const SECTION_ID = "PACKAGE_LIST";
const BEGIN_TAG = `<!-- BEGIN:GENERATED:${SECTION_ID} -->`;
const END_TAG = `<!-- END:GENERATED:${SECTION_ID} -->`;

export type DocsReadmeSentinelCheckReason =
  | "missing-markers"
  | "out-of-date"
  | "up-to-date";

export interface DocsReadmeSentinelCheckResult {
  readonly reason: DocsReadmeSentinelCheckReason;
  readonly updatedContent: string;
}

export function checkDocsReadmeSentinelContent(
  readmeContent: string,
  packageListContent: string
): DocsReadmeSentinelCheckResult {
  if (!(readmeContent.includes(BEGIN_TAG) && readmeContent.includes(END_TAG))) {
    return { reason: "missing-markers", updatedContent: readmeContent };
  }

  const updatedContent = replaceSentinelSection(
    readmeContent,
    SECTION_ID,
    packageListContent
  );

  if (updatedContent !== readmeContent) {
    return { reason: "out-of-date", updatedContent };
  }

  return { reason: "up-to-date", updatedContent };
}

async function run(): Promise<void> {
  const cwdIndex = process.argv.indexOf("--cwd");
  const cwdArg = cwdIndex >= 0 ? process.argv[cwdIndex + 1] : undefined;
  const workspaceRoot = cwdArg ? resolve(cwdArg) : process.cwd();
  const readmePath = join(workspaceRoot, "docs", "README.md");

  const [readmeContent, packageListContent] = await Promise.all([
    readFile(readmePath, "utf8"),
    generatePackageListSection(workspaceRoot),
  ]);

  const result = checkDocsReadmeSentinelContent(
    readmeContent,
    packageListContent
  );

  if (result.reason === "up-to-date") {
    process.stdout.write(
      "docs/README.md PACKAGE_LIST sentinel is up to date.\n"
    );
    return;
  }

  if (result.reason === "missing-markers") {
    process.stderr.write(
      "docs/README.md is missing PACKAGE_LIST sentinel markers.\nRun 'bun run docs:sync:readme' to regenerate sentinel sections.\n"
    );
    process.exit(1);
    return;
  }

  process.stderr.write(
    "docs/README.md PACKAGE_LIST sentinel is stale.\nRun 'bun run docs:sync:readme' to regenerate sentinel sections.\n"
  );
  process.exit(1);
}

if (import.meta.main) {
  await run();
}
