import { runCheckPresetVersionsFromArgv } from "../apps/outfitter/src/commands/check-preset-versions.js";

export {
  printCheckPresetVersionsResult,
  runCheckPresetVersions,
} from "../apps/outfitter/src/commands/check-preset-versions.js";

if (import.meta.main) {
  void runCheckPresetVersionsFromArgv(process.argv.slice(2)).then(
    (exitCode) => {
      process.exit(exitCode);
    }
  );
}
