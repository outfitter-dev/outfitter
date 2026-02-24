/**
 * Shared docs-core types.
 *
 * @packageDocumentation
 */

export type MdxMode = "strict" | "lossy";

export interface PackageDocsOptions {
  readonly excludedFilenames?: readonly string[];
  readonly mdxMode?: MdxMode;
  readonly outputDir?: string;
  readonly packagesDir?: string;
  readonly workspaceRoot?: string;
}

export type LlmsTarget = "llms" | "llms-full";

export interface LlmsDocsOptions extends PackageDocsOptions {
  readonly llmsFile?: string;
  readonly llmsFullFile?: string;
  readonly targets?: readonly LlmsTarget[];
}

export interface SyncPackageDocsResult {
  readonly packageNames: readonly string[];
  readonly removedFiles: readonly string[];
  readonly warnings: readonly DocsWarning[];
  readonly writtenFiles: readonly string[];
}

export type DriftKind = "missing" | "changed" | "unexpected";

export interface DocsDrift {
  readonly kind: DriftKind;
  readonly path: string;
}

export interface DocsWarning {
  readonly message: string;
  readonly path: string;
}

export interface CheckPackageDocsResult {
  readonly drift: readonly DocsDrift[];
  readonly expectedFiles: readonly string[];
  readonly isUpToDate: boolean;
  readonly packageNames: readonly string[];
  readonly warnings: readonly DocsWarning[];
}

export interface SyncLlmsDocsResult {
  readonly packageNames: readonly string[];
  readonly warnings: readonly DocsWarning[];
  readonly writtenFiles: readonly string[];
}

export interface CheckLlmsDocsResult {
  readonly drift: readonly DocsDrift[];
  readonly expectedFiles: readonly string[];
  readonly isUpToDate: boolean;
  readonly packageNames: readonly string[];
  readonly warnings: readonly DocsWarning[];
}

/** @internal */
export interface ResolvedPackageDocsOptions {
  readonly excludedLowercaseNames: ReadonlySet<string>;
  readonly mdxMode: MdxMode;
  readonly outputRoot: string;
  readonly packagesRoot: string;
  readonly workspaceRoot: string;
}

/** @internal */
export interface ExpectedOutput {
  readonly entries: readonly ExpectedOutputEntry[];
  readonly files: ReadonlyMap<string, string>;
  readonly packageNames: readonly string[];
  readonly warnings: readonly DocsWarning[];
}

/** @internal */
export interface ExpectedOutputEntry {
  readonly content: string;
  readonly destinationAbsolutePath: string;
  readonly packageName: string;
}

/** @internal */
export interface CollectedMarkdownFile {
  readonly destinationAbsolutePath: string;
  readonly packageName: string;
  readonly sourceAbsolutePath: string;
}

/** @internal */
export interface ResolvedLlmsOptions {
  readonly llmsFullPath: string;
  readonly llmsPath: string;
  readonly targets: readonly LlmsTarget[];
}
