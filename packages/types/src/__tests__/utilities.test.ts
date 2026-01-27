/**
 * Tests for type utility types.
 *
 * These are compile-time type tests - they verify type behavior at the TypeScript level.
 *
 * @module utilities.test
 */

import { describe, expect, it } from "bun:test";
import {
  type AtLeastOne,
  assertNever,
  type DeepPartial,
  type DeepReadonly,
  type ElementOf,
  type ExactlyOne,
  type Mutable,
  type OptionalKeys,
  type Prettify,
  type RequiredKeys,
  type ValueOf,
} from "../utilities.js";

describe("utilities", () => {
  describe("RequiredKeys<T, K>", () => {
    interface Config {
      host?: string;
      port?: number;
      timeout?: number;
    }

    it("makes specified keys required", () => {
      type WithHost = RequiredKeys<Config, "host">;
      // host should be required, port and timeout remain optional
      const config: WithHost = { host: "localhost" };
      expect(config.host).toBe("localhost");
    });

    it("preserves other optional keys", () => {
      type WithHost = RequiredKeys<Config, "host">;
      const config: WithHost = { host: "localhost", port: 3000 };
      // port is still optional
      expect(config.port).toBe(3000);
    });

    it("works with multiple keys", () => {
      type WithHostPort = RequiredKeys<Config, "host" | "port">;
      const config: WithHostPort = { host: "localhost", port: 3000 };
      expect(config.host).toBe("localhost");
      expect(config.port).toBe(3000);
    });
  });

  describe("OptionalKeys<T, K>", () => {
    interface User {
      id: string;
      name: string;
      email: string;
    }

    it("makes specified keys optional", () => {
      type PartialUser = OptionalKeys<User, "email">;
      // email should be optional now
      const user: PartialUser = { id: "1", name: "Alice" };
      expect(user.name).toBe("Alice");
    });

    it("preserves required keys", () => {
      type PartialUser = OptionalKeys<User, "email">;
      // @ts-expect-error - id and name should still be required
      const _invalid: PartialUser = { id: "1" };
      expect(true).toBe(true);
    });

    it("works with multiple keys", () => {
      type PartialUser = OptionalKeys<User, "name" | "email">;
      const user: PartialUser = { id: "1" };
      expect(user.id).toBe("1");
    });
  });

  describe("DeepReadonly<T>", () => {
    it("makes all properties readonly", () => {
      interface Config {
        host: string;
        port: number;
      }
      type ReadonlyConfig = DeepReadonly<Config>;

      const config: ReadonlyConfig = { host: "localhost", port: 3000 };
      // @ts-expect-error - should not be assignable
      config.host = "changed";
      expect(true).toBe(true);
    });

    it("recurses into nested objects", () => {
      interface Nested {
        outer: { inner: { value: number } };
      }
      type ReadonlyNested = DeepReadonly<Nested>;

      const obj: ReadonlyNested = { outer: { inner: { value: 42 } } };
      // @ts-expect-error - nested property should be readonly
      obj.outer.inner.value = 100;
      expect(true).toBe(true);
    });

    it("handles arrays", () => {
      interface WithArray {
        items: number[];
      }
      type ReadonlyWithArray = DeepReadonly<WithArray>;

      const obj: ReadonlyWithArray = { items: [1, 2, 3] };
      // Array itself should be readonly
      // @ts-expect-error - should not be assignable
      obj.items = [4, 5, 6];
      expect(true).toBe(true);
    });
  });

  describe("DeepPartial<T>", () => {
    it("makes all properties optional", () => {
      interface Config {
        host: string;
        port: number;
      }
      type PartialConfig = DeepPartial<Config>;

      // All properties optional
      const config: PartialConfig = {};
      expect(config.host).toBeUndefined();
    });

    it("recurses into nested objects", () => {
      interface Nested {
        outer: { inner: { value: number } };
      }
      type PartialNested = DeepPartial<Nested>;

      // All nested properties optional
      const obj: PartialNested = { outer: {} };
      expect(obj.outer?.inner?.value).toBeUndefined();
    });

    it("preserves original types when provided", () => {
      interface Config {
        host: string;
        port: number;
      }
      type PartialConfig = DeepPartial<Config>;

      const config: PartialConfig = { host: "localhost" };
      expect(config.host).toBe("localhost");
    });
  });

  describe("AtLeastOne<T, Keys>", () => {
    it("requires at least one of specified keys", () => {
      interface Props {
        a?: string;
        b?: number;
        c?: boolean;
      }
      type AtLeastAorB = AtLeastOne<Props, "a" | "b">;

      // Valid: has 'a'
      const withA: AtLeastAorB = { a: "hello" };
      // Valid: has 'b'
      const withB: AtLeastAorB = { b: 42 };
      // Valid: has both
      const withBoth: AtLeastAorB = { a: "hello", b: 42 };

      expect(withA.a).toBe("hello");
      expect(withB.b).toBe(42);
      expect(withBoth.a).toBe("hello");
    });

    it("rejects when none of the specified keys present", () => {
      interface Props {
        a?: string;
        b?: number;
        c?: boolean;
      }
      type AtLeastAorB = AtLeastOne<Props, "a" | "b">;

      // @ts-expect-error - must have at least a or b
      const _invalid: AtLeastAorB = { c: true };
      expect(true).toBe(true);
    });
  });

  describe("ExactlyOne<T, Keys>", () => {
    it("requires exactly one of specified keys", () => {
      interface Auth {
        token?: string;
        apiKey?: string;
      }
      type OneAuth = ExactlyOne<Auth, "token" | "apiKey">;

      // Valid: has only token
      const withToken: OneAuth = { token: "abc" };
      // Valid: has only apiKey
      const withApiKey: OneAuth = { apiKey: "xyz" };

      expect(withToken.token).toBe("abc");
      expect(withApiKey.apiKey).toBe("xyz");
    });

    it("rejects when both specified keys present", () => {
      interface Auth {
        token?: string;
        apiKey?: string;
      }
      type OneAuth = ExactlyOne<Auth, "token" | "apiKey">;

      // @ts-expect-error - cannot have both token and apiKey
      const _invalid: OneAuth = { token: "abc", apiKey: "xyz" };
      expect(true).toBe(true);
    });

    it("rejects when none of the specified keys present", () => {
      interface Auth {
        token?: string;
        apiKey?: string;
        extra?: boolean;
      }
      type OneAuth = ExactlyOne<Auth, "token" | "apiKey">;

      // @ts-expect-error - must have exactly one of token or apiKey
      const _invalid: OneAuth = { extra: true };
      expect(true).toBe(true);
    });
  });

  describe("ElementOf<T>", () => {
    it("extracts element type from array", () => {
      type Numbers = number[];
      type Num = ElementOf<Numbers>;

      const n: Num = 42;
      expect(n).toBe(42);
    });

    it("extracts element type from readonly array", () => {
      type ReadonlyStrings = readonly string[];
      type Str = ElementOf<ReadonlyStrings>;

      const s: Str = "hello";
      expect(s).toBe("hello");
    });

    it("extracts element type from tuple", () => {
      type Tuple = [string, number, boolean];
      type Elem = ElementOf<Tuple>;

      // Element should be string | number | boolean
      const a: Elem = "hello";
      const b: Elem = 42;
      const c: Elem = true;
      expect([a, b, c]).toEqual(["hello", 42, true]);
    });
  });

  describe("ValueOf<T>", () => {
    it("creates union of object values", () => {
      interface Obj {
        a: string;
        b: number;
        c: boolean;
      }
      type Val = ValueOf<Obj>;

      const s: Val = "hello";
      const n: Val = 42;
      const b: Val = true;
      expect([s, n, b]).toEqual(["hello", 42, true]);
    });

    it("works with const objects", () => {
      const STATUS = {
        PENDING: "pending",
        DONE: "done",
        ERROR: "error",
      } as const;

      type StatusValue = ValueOf<typeof STATUS>;
      const status: StatusValue = "pending";
      expect(status).toBe("pending");
    });
  });

  describe("Mutable<T>", () => {
    it("removes readonly from properties", () => {
      interface Frozen {
        readonly x: number;
        readonly y: string;
      }
      type Thawed = Mutable<Frozen>;

      const obj: Thawed = { x: 1, y: "a" };
      obj.x = 2; // Should be allowed
      obj.y = "b";
      expect(obj).toEqual({ x: 2, y: "b" });
    });

    it("makes readonly arrays mutable", () => {
      interface ReadonlyObj {
        readonly items: readonly number[];
      }
      type MutableObj = Mutable<ReadonlyObj>;

      const obj: MutableObj = { items: [1, 2, 3] };
      obj.items = [4, 5]; // items property is now mutable
      expect(obj.items).toEqual([4, 5]);
    });
  });

  describe("assertNever()", () => {
    type Status = "pending" | "done";

    function processStatus(status: Status): string {
      switch (status) {
        case "pending":
          return "waiting";
        case "done":
          return "complete";
        default:
          return assertNever(status);
      }
    }

    it("throws when reached at runtime", () => {
      // Force an invalid value past TypeScript
      const invalid = "unknown" as Status;
      expect(() => {
        switch (invalid) {
          case "pending":
            return "waiting";
          case "done":
            return "complete";
          default:
            return assertNever(invalid as never);
        }
      }).toThrow();
    });

    it("includes value in error message", () => {
      expect(() => assertNever("bad" as never)).toThrow(/bad/);
    });

    it("enables exhaustiveness checking", () => {
      // This test verifies that the switch is exhaustive at compile time
      const result = processStatus("pending");
      expect(result).toBe("waiting");
    });
  });

  describe("Prettify<T>", () => {
    it("flattens simple intersection types", () => {
      interface A {
        a: string;
      }
      interface B {
        b: number;
      }
      type Intersection = A & B;
      type Flattened = Prettify<Intersection>;

      // The Prettified type should have both properties as direct members
      const obj: Flattened = { a: "hello", b: 42 };
      expect(obj.a).toBe("hello");
      expect(obj.b).toBe(42);

      // Verify the types are assignable both ways
      const _asIntersection: Intersection = obj;
      const _asFlattened: Flattened = _asIntersection;
      expect(true).toBe(true);
    });

    it("works with nested objects", () => {
      interface Outer {
        outer: { nested: string };
      }
      interface Inner {
        inner: { deep: number };
      }
      type Combined = Prettify<Outer & Inner>;

      const obj: Combined = {
        outer: { nested: "value" },
        inner: { deep: 123 },
      };
      expect(obj.outer.nested).toBe("value");
      expect(obj.inner.deep).toBe(123);
    });

    it("preserves optional properties", () => {
      interface RequiredProps {
        required: string;
      }
      interface OptionalProps {
        optional?: number;
      }
      type Mixed = Prettify<RequiredProps & OptionalProps>;

      // optional should remain optional
      const withoutOptional: Mixed = { required: "yes" };
      const withOptional: Mixed = { required: "yes", optional: 42 };

      expect(withoutOptional.required).toBe("yes");
      expect(withOptional.optional).toBe(42);
    });

    it("preserves readonly properties", () => {
      interface MutableProps {
        mutable: string;
      }
      interface ReadonlyProps {
        readonly immutable: number;
      }
      type Combined = Prettify<MutableProps & ReadonlyProps>;

      const obj: Combined = { mutable: "change me", immutable: 42 };
      obj.mutable = "changed";
      // @ts-expect-error - immutable should remain readonly
      obj.immutable = 100;
      expect(obj.mutable).toBe("changed");
    });

    it("handles complex multi-way intersections", () => {
      interface A {
        a: string;
      }
      interface B {
        b: number;
      }
      interface C {
        c: boolean;
      }
      interface D {
        d: null;
      }
      type Complex = Prettify<A & B & C & D>;

      const obj: Complex = { a: "str", b: 1, c: true, d: null };
      expect(obj).toEqual({ a: "str", b: 1, c: true, d: null });
    });

    it("works with function properties", () => {
      interface WithMethod {
        method: () => void;
      }
      interface WithValue {
        value: string;
      }
      type Combined = Prettify<WithMethod & WithValue>;

      const noop = (): void => {
        // intentionally empty
      };
      const obj: Combined = {
        method: noop,
        value: "test",
      };
      expect(typeof obj.method).toBe("function");
      expect(obj.value).toBe("test");
    });

    it("is a no-op on simple object types", () => {
      interface Simple {
        a: string;
        b: number;
      }
      type Prettified = Prettify<Simple>;

      const obj: Prettified = { a: "hello", b: 42 };
      const _asSimple: Simple = obj;
      expect(obj).toEqual({ a: "hello", b: 42 });
    });
  });
});
