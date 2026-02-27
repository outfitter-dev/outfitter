import { describe, expect, it } from "bun:test";

import {
  type ErrorCategory,
  InternalError,
  NetworkError,
  NotFoundError,
  TimeoutError,
  ValidationError,
} from "../errors.js";
import {
  type ErrorMapper,
  composeMappers,
  isOutfitterError,
  wrapError,
} from "../wrap-error.js";

// ---------------------------------------------------------------------------
// isOutfitterError — type guard
// ---------------------------------------------------------------------------
describe("isOutfitterError", () => {
  it("returns true for typed Outfitter errors", () => {
    const err = new ValidationError({ message: "bad input" });
    expect(isOutfitterError(err)).toBe(true);
  });

  it("returns true for all error categories", () => {
    const errors = [
      new InternalError({ message: "boom" }),
      new NetworkError({ message: "offline" }),
      new NotFoundError({
        message: "gone",
        resourceType: "file",
        resourceId: "x",
      }),
      new TimeoutError({ message: "slow", operation: "op", timeoutMs: 1000 }),
    ];
    for (const err of errors) {
      expect(isOutfitterError(err)).toBe(true);
    }
  });

  it("returns false for plain Error", () => {
    expect(isOutfitterError(new Error("plain"))).toBe(false);
  });

  it("returns false for non-error objects", () => {
    expect(isOutfitterError({ message: "not an error" })).toBe(false);
  });

  it("returns false for plain objects that mimic OutfitterError shape", () => {
    expect(
      isOutfitterError({
        _tag: "ValidationError",
        category: "validation",
        message: "looks typed but is not an Error instance",
      })
    ).toBe(false);
  });

  it("returns false for null and undefined", () => {
    expect(isOutfitterError(null)).toBe(false);
    expect(isOutfitterError(undefined)).toBe(false);
  });

  it("returns false for strings", () => {
    expect(isOutfitterError("some string")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// wrapError — typed passthrough
// ---------------------------------------------------------------------------
describe("wrapError", () => {
  describe("typed Outfitter errors pass through unchanged", () => {
    it("returns the same reference for a ValidationError", () => {
      const original = new ValidationError({ message: "bad" });
      const wrapped = wrapError(original);
      expect(wrapped).toBe(original);
    });

    it("returns the same reference for an InternalError", () => {
      const original = new InternalError({ message: "boom" });
      const wrapped = wrapError(original);
      expect(wrapped).toBe(original);
    });

    it("does NOT call the mapper for typed errors", () => {
      const original = new ValidationError({ message: "bad" });
      let mapperCalled = false;
      const mapper: ErrorMapper = () => {
        mapperCalled = true;
        return new InternalError({ message: "should not reach" });
      };
      const wrapped = wrapError(original, mapper);
      expect(wrapped).toBe(original);
      expect(mapperCalled).toBe(false);
    });

    it("preserves the exact category of the original error", () => {
      const original = new NotFoundError({
        message: "gone",
        resourceType: "file",
        resourceId: "x",
      });
      const wrapped = wrapError(original);
      expect(wrapped.category).toBe("not_found");
    });

    it("does not pass through plain objects with forged OutfitterError fields", () => {
      const forged = {
        _tag: "ValidationError",
        category: "validation",
        message: "forged",
      };
      const wrapped = wrapError(forged);
      expect(wrapped).toBeInstanceOf(InternalError);
      expect(wrapped).not.toBe(forged);
      expect(wrapped.category).toBe("internal");
    });
  });

  // ---------------------------------------------------------------------------
  // wrapError — untyped errors with mapper
  // ---------------------------------------------------------------------------
  describe("untyped errors go through optional mapper", () => {
    it("calls mapper for a plain Error", () => {
      const plain = new Error("plain error");
      const mapper: ErrorMapper = (err) => {
        if (err instanceof Error && err.message === "plain error") {
          return new NetworkError({ message: err.message });
        }
        return undefined;
      };
      const wrapped = wrapError(plain, mapper);
      expect(wrapped).toBeInstanceOf(NetworkError);
      expect(wrapped.message).toBe("plain error");
    });

    it("wraps as InternalError when mapper returns undefined", () => {
      const plain = new Error("unmatched");
      // eslint-disable-next-line unicorn/consistent-function-scoping -- test clarity
      const mapper: ErrorMapper = () => undefined;
      const wrapped = wrapError(plain, mapper);
      expect(wrapped).toBeInstanceOf(InternalError);
      expect(wrapped.message).toBe("unmatched");
    });
  });

  // ---------------------------------------------------------------------------
  // wrapError — no mapper
  // ---------------------------------------------------------------------------
  describe("without mapper wraps as InternalError", () => {
    it("wraps plain Error as InternalError", () => {
      const plain = new Error("something went wrong");
      const wrapped = wrapError(plain);
      expect(wrapped).toBeInstanceOf(InternalError);
      expect(wrapped.message).toBe("something went wrong");
      expect(wrapped.category).toBe("internal");
    });

    it("wraps TypeError as InternalError", () => {
      const err = new TypeError("cannot read property");
      const wrapped = wrapError(err);
      expect(wrapped).toBeInstanceOf(InternalError);
      expect(wrapped.message).toBe("cannot read property");
    });

    it("wraps arbitrary object as InternalError with stringified message", () => {
      const wrapped = wrapError({ code: 42 });
      expect(wrapped).toBeInstanceOf(InternalError);
      expect(wrapped.category).toBe("internal");
    });

    it("wraps null as InternalError", () => {
      const wrapped = wrapError(null);
      expect(wrapped).toBeInstanceOf(InternalError);
      expect(wrapped.category).toBe("internal");
    });

    it("wraps undefined as InternalError", () => {
      const wrapped = wrapError(undefined);
      expect(wrapped).toBeInstanceOf(InternalError);
      expect(wrapped.category).toBe("internal");
    });
  });

  // ---------------------------------------------------------------------------
  // wrapError — string input
  // ---------------------------------------------------------------------------
  describe("string input", () => {
    it("wraps a plain string as InternalError with that message", () => {
      const wrapped = wrapError("something failed");
      expect(wrapped).toBeInstanceOf(InternalError);
      expect(wrapped.message).toBe("something failed");
      expect(wrapped.category).toBe("internal");
    });

    it("wraps an empty string as InternalError", () => {
      const wrapped = wrapError("");
      expect(wrapped).toBeInstanceOf(InternalError);
      expect(wrapped.message).toBe("Unknown error");
    });
  });
});

// ---------------------------------------------------------------------------
// composeMappers — composable mapper pipeline
// ---------------------------------------------------------------------------
describe("composeMappers", () => {
  it("runs mappers in declared order", () => {
    const order: number[] = [];
    const m1: ErrorMapper = () => {
      order.push(1);
      return undefined;
    };
    const m2: ErrorMapper = () => {
      order.push(2);
      return new NetworkError({ message: "matched" });
    };
    const m3: ErrorMapper = () => {
      order.push(3);
      return undefined;
    };

    const composed = composeMappers(m1, m2, m3);
    const result = composed(new Error("test"));
    expect(order).toEqual([1, 2]);
    expect(result).toBeInstanceOf(NetworkError);
  });

  it("short-circuits on first match", () => {
    let secondCalled = false;
    const m1: ErrorMapper = () =>
      new ValidationError({ message: "first match" });
    const m2: ErrorMapper = () => {
      secondCalled = true;
      return new InternalError({ message: "should not reach" });
    };

    const composed = composeMappers(m1, m2);
    const result = composed(new Error("test"));
    expect(result).toBeInstanceOf(ValidationError);
    expect(result?.message).toBe("first match");
    expect(secondCalled).toBe(false);
  });

  it("returns undefined when no mapper matches", () => {
    // eslint-disable-next-line unicorn/consistent-function-scoping -- test clarity
    const m1: ErrorMapper = () => undefined;
    // eslint-disable-next-line unicorn/consistent-function-scoping -- test clarity
    const m2: ErrorMapper = () => undefined;

    const composed = composeMappers(m1, m2);
    const result = composed(new Error("test"));
    expect(result).toBeUndefined();
  });

  it("works with wrapError for end-to-end composition", () => {
    const networkMapper: ErrorMapper = (err) => {
      if (err instanceof Error && err.message.includes("ECONNREFUSED")) {
        return new NetworkError({ message: err.message });
      }
      return undefined;
    };
    const timeoutMapper: ErrorMapper = (err) => {
      if (err instanceof Error && err.message.includes("ETIMEDOUT")) {
        return TimeoutError.create("request", 5000);
      }
      return undefined;
    };

    const composed = composeMappers(networkMapper, timeoutMapper);

    // Network error matches first mapper
    const netErr = wrapError(new Error("ECONNREFUSED"), composed);
    expect(netErr).toBeInstanceOf(NetworkError);

    // Timeout error matches second mapper
    const timeErr = wrapError(new Error("ETIMEDOUT"), composed);
    expect(timeErr).toBeInstanceOf(TimeoutError);

    // Unmatched error falls through to InternalError
    const unknownErr = wrapError(new Error("something else"), composed);
    expect(unknownErr).toBeInstanceOf(InternalError);
  });

  it("handles single mapper", () => {
    const m1: ErrorMapper = () =>
      new ValidationError({ message: "single match" });
    const composed = composeMappers(m1);
    const result = composed(new Error("test"));
    expect(result).toBeInstanceOf(ValidationError);
  });

  it("handles empty mapper list", () => {
    const composed = composeMappers();
    const result = composed(new Error("test"));
    expect(result).toBeUndefined();
  });
});
