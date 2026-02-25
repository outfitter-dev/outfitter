/**
 * Tests for confirmDestructive().
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// Must import after clack mock is set up
import { confirmDestructive } from "../confirm.js";
import {
  cancelSymbol,
  confirmMock,
  queueConfirmResponse,
  resetClackMocks,
} from "./clack-mock.js";

// =============================================================================
// Setup
// =============================================================================

let originalTTY: boolean | undefined;
let originalTERM: string | undefined;

beforeEach(() => {
  originalTTY = process.stdout.isTTY;
  originalTERM = process.env.TERM;
  resetClackMocks();
});

afterEach(() => {
  Object.defineProperty(process.stdout, "isTTY", {
    value: originalTTY,
    writable: true,
    configurable: true,
  });
  if (originalTERM === undefined) {
    delete process.env.TERM;
  } else {
    process.env.TERM = originalTERM;
  }
});

// =============================================================================
// confirmDestructive() Tests
// =============================================================================

function setInteractiveTerminal(): void {
  process.env.TERM = "xterm-256color";
  Object.defineProperty(process.stdout, "isTTY", {
    value: true,
    writable: true,
    configurable: true,
  });
}

describe("confirmDestructive()", () => {
  test("returns Ok(true) when bypassFlag is true", async () => {
    const result = await confirmDestructive({
      message: "Delete 5 items?",
      bypassFlag: true,
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(true);
    }
    expect(confirmMock).not.toHaveBeenCalled();
  });

  test("returns Ok(true) when user confirms (mock)", async () => {
    setInteractiveTerminal();
    queueConfirmResponse(true);

    const result = await confirmDestructive({
      message: "Delete items?",
      bypassFlag: false,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(true);
    }
  });

  test("returns Err(CancelledError) when user declines", async () => {
    setInteractiveTerminal();
    queueConfirmResponse(false);

    const result = await confirmDestructive({
      message: "Delete items?",
      bypassFlag: false,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("cancelled");
    }
  });

  test("returns Err(CancelledError) when prompt is cancelled", async () => {
    setInteractiveTerminal();
    queueConfirmResponse(cancelSymbol);

    const result = await confirmDestructive({
      message: "Delete items?",
      bypassFlag: false,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("cancelled");
    }
  });

  test("includes itemCount in prompt", async () => {
    setInteractiveTerminal();
    queueConfirmResponse(true);

    const result = await confirmDestructive({
      message: "Delete items?",
      bypassFlag: false,
      itemCount: 10,
    });

    expect(result.isOk()).toBe(true);
    expect(confirmMock).toHaveBeenCalledTimes(1);
    const call = confirmMock.mock.calls[0]?.[0];
    expect(call?.message).toContain("(10 items)");
  });

  test("handles non-TTY (returns Err)", async () => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });

    const result = await confirmDestructive({
      message: "Delete items?",
      bypassFlag: false,
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("non-interactive mode");
    }
  });

  test("respects TERM=dumb", async () => {
    process.env.TERM = "dumb";
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      writable: true,
      configurable: true,
    });

    const result = await confirmDestructive({
      message: "Delete items?",
      bypassFlag: false,
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("non-interactive mode");
    }
  });
});
