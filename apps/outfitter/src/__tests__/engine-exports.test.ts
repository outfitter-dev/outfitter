import { describe, expect, test } from "bun:test";

import * as engine from "../engine/index.js";

describe("engine exports", () => {
  test("exposes preset-native helpers without legacy template aliases", () => {
    expect(engine.getPresetsBaseDir).toBeFunction();
    expect(engine.copyPresetFiles).toBeFunction();
    expect("getTemplatesDir" in engine).toBe(false);
    expect("copyTemplateFiles" in engine).toBe(false);
  });
});
