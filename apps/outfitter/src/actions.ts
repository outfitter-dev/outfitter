/**
 * Action registry for Outfitter CLI.
 *
 * @packageDocumentation
 */

import {
  type ActionRegistry,
  createActionRegistry,
} from "@outfitter/contracts";

import { addAction, listBlocksAction } from "./actions/add.js";
import {
  checkActionCeremonyAction,
  checkActionRegistryAction,
  checkDocsSentinelAction,
  checkPresetVersionsAction,
  checkPublishGuardrailsAction,
  checkSurfaceMapAction,
  checkSurfaceMapFormatAction,
} from "./actions/check-automation.js";
import { checkAction, checkTsdocAction } from "./actions/check.js";
import { demoAction } from "./actions/demo.js";
import {
  docsApiAction,
  docsExportAction,
  docsListAction,
  docsSearchAction,
  docsShowAction,
} from "./actions/docs.js";
import { doctorAction } from "./actions/doctor.js";
import {
  createAction,
  initAction,
  initCliAction,
  initDaemonAction,
  initFullStackAction,
  initLibraryAction,
  initMcpAction,
} from "./actions/init.js";
import { scaffoldAction } from "./actions/scaffold.js";
import { upgradeAction } from "./actions/upgrade.js";

/** Central action registry containing all Outfitter CLI commands. */
export const outfitterActions: ActionRegistry = createActionRegistry()
  .add(createAction)
  .add(scaffoldAction)
  .add(initAction)
  .add(initCliAction)
  .add(initMcpAction)
  .add(initDaemonAction)
  .add(initLibraryAction)
  .add(initFullStackAction)
  .add(demoAction)
  .add(doctorAction)
  .add(addAction)
  .add(listBlocksAction)
  .add(checkAction)
  .add(checkTsdocAction)
  .add(checkPublishGuardrailsAction)
  .add(checkPresetVersionsAction)
  .add(checkSurfaceMapAction)
  .add(checkSurfaceMapFormatAction)
  .add(checkDocsSentinelAction)
  .add(checkActionCeremonyAction)
  .add(checkActionRegistryAction)
  .add(upgradeAction)
  .add(docsListAction)
  .add(docsShowAction)
  .add(docsSearchAction)
  .add(docsApiAction)
  .add(docsExportAction);
