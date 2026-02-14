/**
 * Tests for select prompt page size mapping.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import {
  multiselectCalls,
  resetClackMocks,
  selectCalls,
} from "./clack-mock.js";

const { promptMultiSelect, promptSelect } = await import("../prompt/select.js");

beforeEach(() => {
  resetClackMocks();
});

describe("promptSelect", () => {
  test("maps pageSize to maxItems", async () => {
    await promptSelect({
      message: "Pick one",
      options: [
        { value: "one", label: "One" },
        { value: "two", label: "Two" },
      ],
      pageSize: 4,
    });

    expect(selectCalls).toHaveLength(1);
    const call = selectCalls[0] as { maxItems?: number };
    expect(call.maxItems).toBe(4);
  });
});

describe("promptMultiSelect", () => {
  test("maps pageSize to maxItems", async () => {
    await promptMultiSelect({
      message: "Pick many",
      options: [
        { value: "one", label: "One" },
        { value: "two", label: "Two" },
      ],
      pageSize: 6,
    });

    expect(multiselectCalls).toHaveLength(1);
    const call = multiselectCalls[0] as { maxItems?: number };
    expect(call.maxItems).toBe(6);
  });
});
