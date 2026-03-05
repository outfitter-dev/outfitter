/**
 * Types for schema introspection commands.
 *
 * @internal
 */

/** Options for surface map subcommands (generate, diff). */
export interface SurfaceCommandOptions {
  readonly cwd?: string;
  readonly outputDir?: string;
}

/** Options for the schema Commander command. */
export interface SchemaCommandOptions {
  readonly programName?: string;
  readonly surface?: SurfaceCommandOptions;
}
