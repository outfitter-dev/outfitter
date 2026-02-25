import { runCheckSurfaceMapFormatFromArgv } from "../apps/outfitter/src/commands/check-surface-map-format.js";

export {
  canonicalizeJson,
  checkSurfaceMapFormat,
  printCheckSurfaceMapFormatResult,
  runCheckSurfaceMapFormat,
} from "../apps/outfitter/src/commands/check-surface-map-format.js";
export type {
  CheckSurfaceMapFormatResult,
  SurfaceMapFormatCheckResult,
} from "../apps/outfitter/src/commands/check-surface-map-format.js";

if (import.meta.main) {
  void runCheckSurfaceMapFormatFromArgv(process.argv.slice(2)).then(
    (exitCode) => {
      process.exit(exitCode);
    }
  );
}
