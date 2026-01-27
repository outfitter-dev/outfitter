/**
 * Tests for deep path type utilities.
 *
 * These are compile-time type tests - they verify type behavior at the TypeScript level.
 *
 * @module deep.test
 */

import { describe, expect, it } from "bun:test";
import type { DeepGet, DeepKeys, DeepSet } from "../deep.js";

describe("deep path types", () => {
  describe("DeepKeys<T>", () => {
    it("extracts top-level keys", () => {
      interface T {
        a: string;
        b: number;
      }
      type Keys = DeepKeys<T>;

      // Should produce "a" | "b"
      const key1: Keys = "a";
      const key2: Keys = "b";
      // @ts-expect-error - "c" is not a valid key
      const _invalid: Keys = "c";

      expect(key1).toBe("a");
      expect(key2).toBe("b");
    });

    it("extracts nested keys with dot notation", () => {
      interface T {
        database: { host: string; port: number };
      }
      type Keys = DeepKeys<T>;

      // Should produce "database" | "database.host" | "database.port"
      const key1: Keys = "database";
      const key2: Keys = "database.host";
      const key3: Keys = "database.port";
      // @ts-expect-error - "database.invalid" is not a valid path
      const _invalid: Keys = "database.invalid";

      expect(key1).toBe("database");
      expect(key2).toBe("database.host");
      expect(key3).toBe("database.port");
    });

    it("handles deeply nested objects", () => {
      interface T {
        a: { b: { c: string } };
      }
      type Keys = DeepKeys<T>;

      // Should produce "a" | "a.b" | "a.b.c"
      const key1: Keys = "a";
      const key2: Keys = "a.b";
      const key3: Keys = "a.b.c";
      // @ts-expect-error - "a.b.c.d" goes too deep
      const _invalid: Keys = "a.b.c.d";

      expect(key1).toBe("a");
      expect(key2).toBe("a.b");
      expect(key3).toBe("a.b.c");
    });

    it("treats arrays as leaf nodes", () => {
      interface T {
        items: string[];
        nested: { list: number[] };
      }
      type Keys = DeepKeys<T>;

      // Arrays should be leaf nodes - don't recurse into them
      const key1: Keys = "items";
      const key2: Keys = "nested";
      const key3: Keys = "nested.list";
      // @ts-expect-error - "items.0" should not be valid (arrays are leaves)
      const _invalid: Keys = "items.0";

      expect(key1).toBe("items");
      expect(key2).toBe("nested");
      expect(key3).toBe("nested.list");
    });

    it("handles mixed object with arrays and primitives", () => {
      interface T {
        name: string;
        config: {
          enabled: boolean;
          tags: string[];
        };
      }
      type Keys = DeepKeys<T>;

      const key1: Keys = "name";
      const key2: Keys = "config";
      const key3: Keys = "config.enabled";
      const key4: Keys = "config.tags";

      expect(key1).toBe("name");
      expect(key2).toBe("config");
      expect(key3).toBe("config.enabled");
      expect(key4).toBe("config.tags");
    });

    it("returns never for primitives", () => {
      type StringKeys = DeepKeys<string>;
      type NumberKeys = DeepKeys<number>;

      // Primitives should yield never
      // We can't directly test never assignment, but we can verify the behavior
      // by checking that the type is assignable to never only if it IS never
      const _checkString: StringKeys extends never ? true : false = true;
      const _checkNumber: NumberKeys extends never ? true : false = true;

      expect(true).toBe(true);
    });
  });

  describe("DeepGet<T, P>", () => {
    it("gets top-level type", () => {
      interface T {
        a: string;
        b: number;
      }

      type A = DeepGet<T, "a">;
      type B = DeepGet<T, "b">;

      const a: A = "hello";
      const b: B = 42;

      expect(a).toBe("hello");
      expect(b).toBe(42);
    });

    it("gets nested type via dot notation", () => {
      interface T {
        database: { host: string; port: number };
      }

      type Host = DeepGet<T, "database.host">;
      type Port = DeepGet<T, "database.port">;

      const host: Host = "localhost";
      const port: Port = 3000;

      expect(host).toBe("localhost");
      expect(port).toBe(3000);
    });

    it("gets intermediate object type", () => {
      interface T {
        database: { host: string; port: number };
      }

      type DB = DeepGet<T, "database">;

      const db: DB = { host: "localhost", port: 3000 };

      expect(db.host).toBe("localhost");
      expect(db.port).toBe(3000);
    });

    it("gets deeply nested type", () => {
      interface T {
        a: { b: { c: { value: boolean } } };
      }

      type Value = DeepGet<T, "a.b.c.value">;
      type C = DeepGet<T, "a.b.c">;

      const value: Value = true;
      const c: C = { value: false };

      expect(value).toBe(true);
      expect(c.value).toBe(false);
    });

    it("returns never for invalid paths", () => {
      interface T {
        a: string;
      }

      type Invalid1 = DeepGet<T, "b">;
      type Invalid2 = DeepGet<T, "a.b">;
      type Invalid3 = DeepGet<T, "a.b.c">;

      // All invalid paths should be never
      const _check1: Invalid1 extends never ? true : false = true;
      const _check2: Invalid2 extends never ? true : false = true;
      const _check3: Invalid3 extends never ? true : false = true;

      expect(true).toBe(true);
    });

    it("gets array type at path", () => {
      interface T {
        items: string[];
        nested: { list: number[] };
      }

      type Items = DeepGet<T, "items">;
      type List = DeepGet<T, "nested.list">;

      const items: Items = ["a", "b"];
      const list: List = [1, 2];

      expect(items).toEqual(["a", "b"]);
      expect(list).toEqual([1, 2]);
    });
  });

  describe("DeepSet<T, P, V>", () => {
    it("replaces top-level type", () => {
      interface T {
        a: string;
        b: number;
      }
      type Result = DeepSet<T, "a", boolean>;

      const obj: Result = { a: true, b: 42 };

      // Type assertion: a is now boolean
      const _typeCheck: boolean = obj.a;
      // b should still be number
      const _bCheck: number = obj.b;

      expect(obj.a).toBe(true);
      expect(obj.b).toBe(42);
    });

    it("replaces nested type via dot notation", () => {
      interface T {
        database: { host: string; port: number };
      }
      type Result = DeepSet<T, "database.port", string>;

      const obj: Result = { database: { host: "localhost", port: "3000" } };

      // port should now be string
      const _portCheck: string = obj.database.port;
      // host should still be string
      const _hostCheck: string = obj.database.host;

      expect(obj.database.port).toBe("3000");
      expect(obj.database.host).toBe("localhost");
    });

    it("replaces deeply nested type", () => {
      interface T {
        a: { b: { c: string } };
      }
      type Result = DeepSet<T, "a.b.c", number>;

      const obj: Result = { a: { b: { c: 42 } } };

      const _cCheck: number = obj.a.b.c;

      expect(obj.a.b.c).toBe(42);
    });

    it("replaces object with different structure", () => {
      interface T {
        config: { host: string };
      }
      type Result = DeepSet<T, "config", { url: string }>;

      const obj: Result = { config: { url: "http://localhost" } };

      // config should now have url, not host
      const _urlCheck: string = obj.config.url;
      // @ts-expect-error - host no longer exists
      const _invalid = obj.config.host;

      expect(obj.config.url).toBe("http://localhost");
    });

    it("preserves sibling properties", () => {
      interface T {
        a: string;
        b: number;
        c: boolean;
      }
      type Result = DeepSet<T, "b", string>;

      const obj: Result = { a: "hello", b: "world", c: true };

      // a should still be string
      const _aCheck: string = obj.a;
      // b should now be string
      const _bCheck: string = obj.b;
      // c should still be boolean
      const _cCheck: boolean = obj.c;

      expect(obj).toEqual({ a: "hello", b: "world", c: true });
    });

    it("preserves nested sibling properties", () => {
      interface T {
        outer: { a: string; b: number };
      }
      type Result = DeepSet<T, "outer.a", boolean>;

      const obj: Result = { outer: { a: true, b: 42 } };

      // a should now be boolean
      const _aCheck: boolean = obj.outer.a;
      // b should still be number
      const _bCheck: number = obj.outer.b;

      expect(obj.outer.a).toBe(true);
      expect(obj.outer.b).toBe(42);
    });
  });

  describe("edge cases", () => {
    it("handles optional properties in DeepKeys", () => {
      interface T {
        required: string;
        optional?: number;
      }
      type Keys = DeepKeys<T>;

      const key1: Keys = "required";
      const key2: Keys = "optional";

      expect(key1).toBe("required");
      expect(key2).toBe("optional");
    });

    it("handles optional object properties in DeepKeys", () => {
      // This is the specific case from PR #21 feedback
      // Optional object properties should still recurse to emit nested keys
      interface T {
        config?: { host: string };
      }
      type Keys = DeepKeys<T>;

      // Should produce "config" | "config.host"
      const key1: Keys = "config";
      const key2: Keys = "config.host";
      // @ts-expect-error - "config.invalid" is not a valid path
      const _invalid: Keys = "config.invalid";

      expect(key1).toBe("config");
      expect(key2).toBe("config.host");
    });

    it("handles deeply nested optional object properties", () => {
      interface T {
        outer?: { inner?: { value: string } };
      }
      type Keys = DeepKeys<T>;

      // Should recurse through multiple optional levels
      const key1: Keys = "outer";
      const key2: Keys = "outer.inner";
      const key3: Keys = "outer.inner.value";

      expect(key1).toBe("outer");
      expect(key2).toBe("outer.inner");
      expect(key3).toBe("outer.inner.value");
    });

    it("handles optional nested properties in DeepGet", () => {
      interface T {
        config?: { host: string };
      }

      // When the parent is optional, we can still access the nested type
      type Host = DeepGet<T, "config.host">;
      const host: Host = "localhost";

      expect(host).toBe("localhost");
    });

    it("handles readonly properties", () => {
      interface T {
        readonly id: string;
        data: { readonly value: number };
      }
      type Keys = DeepKeys<T>;

      const key1: Keys = "id";
      const key2: Keys = "data";
      const key3: Keys = "data.value";

      expect(key1).toBe("id");
      expect(key2).toBe("data");
      expect(key3).toBe("data.value");
    });

    it("handles union types in object values", () => {
      interface T {
        status: "active" | "inactive";
        config: { mode: "dev" | "prod" };
      }

      type Status = DeepGet<T, "status">;
      type Mode = DeepGet<T, "config.mode">;

      const status: Status = "active";
      const mode: Mode = "dev";

      expect(status).toBe("active");
      expect(mode).toBe("dev");
    });

    it("handles empty objects", () => {
      type Empty = Record<string, never>;
      type Keys = DeepKeys<Empty>;

      // Empty object should yield never for keys
      const _check: Keys extends never ? true : false = true;

      expect(true).toBe(true);
    });
  });
});
