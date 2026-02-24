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
  .add(upgradeAction)
  .add(docsListAction)
  .add(docsShowAction)
  .add(docsSearchAction)
  .add(docsApiAction)
  .add(docsExportAction);
