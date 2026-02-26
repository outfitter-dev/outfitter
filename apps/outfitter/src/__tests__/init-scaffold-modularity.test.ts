import { describe, expect, test } from "bun:test";

import { executeInitPipeline } from "../commands/init-execution.js";
import { parseBlocks } from "../commands/init-option-resolution.js";
import { printInitResults as printInitResultsFromOutput } from "../commands/init-output.js";
import { printInitResults, runInit } from "../commands/init.js";
import { printScaffoldResults as printScaffoldResultsFromOutput } from "../commands/scaffold-output.js";
import { buildScaffoldPlan } from "../commands/scaffold-planning.js";
import { printScaffoldResults, runScaffold } from "../commands/scaffold.js";

describe("init/scaffold modularity boundaries", () => {
  test("keeps init output helper re-exported through init entrypoint", () => {
    expect(printInitResults).toBe(printInitResultsFromOutput);
  });

  test("keeps scaffold output helper re-exported through scaffold entrypoint", () => {
    expect(printScaffoldResults).toBe(printScaffoldResultsFromOutput);
  });

  test("keeps extracted init/scaffold modules importable", () => {
    expect(typeof runInit).toBe("function");
    expect(typeof printInitResults).toBe("function");
    expect(typeof executeInitPipeline).toBe("function");
    expect(typeof parseBlocks).toBe("function");
    expect(typeof runScaffold).toBe("function");
    expect(typeof printScaffoldResults).toBe("function");
    expect(typeof buildScaffoldPlan).toBe("function");
  });
});
