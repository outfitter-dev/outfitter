/**
 * Tests for @outfitter/contracts/adapters
 *
 * These are compile-time type tests that verify the adapter interfaces
 * work correctly with mock implementations.
 *
 * Tests cover:
 * - IndexAdapter interface (2 tests)
 * - CacheAdapter interface (2 tests)
 * - AuthAdapter interface (2 tests)
 * - StorageAdapter interface (2 tests)
 *
 * Total: 8 tests (compile-time verification)
 */
import { describe, expect, it } from "bun:test";
import { Result } from "better-result";
import type {
  AdapterAuthError,
  AuthAdapter,
  CacheAdapter,
  CacheError,
  IndexAdapter,
  IndexError,
  IndexStats,
  SearchOptions,
  SearchResult,
  StorageAdapter,
  StorageError,
} from "../adapters.js";

// ============================================================================
// IndexAdapter Interface Tests (2 tests)
// ============================================================================

describe("IndexAdapter interface", () => {
  interface TestDocument {
    id: string;
    title: string;
    content: string;
  }

  it("compiles with mock implementation", () => {
    // This test verifies that the interface can be implemented
    const mockIndex: IndexAdapter<TestDocument> = {
      async index(_items: TestDocument[]): Promise<Result<void, IndexError>> {
        return Result.ok(undefined);
      },
      async search(
        _query: string,
        _options?: SearchOptions
      ): Promise<Result<SearchResult<TestDocument>, IndexError>> {
        return Result.ok({
          hits: [],
          total: 0,
          took: 0,
        });
      },
      async remove(_ids: string[]): Promise<Result<void, IndexError>> {
        return Result.ok(undefined);
      },
      async clear(): Promise<Result<void, IndexError>> {
        return Result.ok(undefined);
      },
      async stats(): Promise<Result<IndexStats, IndexError>> {
        return Result.ok({
          documentCount: 0,
          lastUpdated: null,
        });
      },
    };

    // Verify all methods exist
    expect(typeof mockIndex.index).toBe("function");
    expect(typeof mockIndex.search).toBe("function");
    expect(typeof mockIndex.remove).toBe("function");
    expect(typeof mockIndex.clear).toBe("function");
    expect(typeof mockIndex.stats).toBe("function");
  });

  it("returns correct types from methods", async () => {
    const mockIndex: IndexAdapter<TestDocument> = {
      async index(_items) {
        return Result.ok(undefined);
      },
      async search(_query, _options) {
        return Result.ok({
          hits: [
            {
              item: { id: "1", title: "Test", content: "Content" },
              score: 1.0,
            },
          ],
          total: 1,
          took: 5,
        });
      },
      async remove(_ids) {
        return Result.ok(undefined);
      },
      async clear() {
        return Result.ok(undefined);
      },
      async stats() {
        return Result.ok({
          documentCount: 10,
          sizeBytes: 1024,
          lastUpdated: new Date(),
        });
      },
    };

    const searchResult = await mockIndex.search("test");
    expect(searchResult.isOk()).toBe(true);

    if (searchResult.isOk()) {
      const data = searchResult.unwrap();
      expect(data.hits).toBeInstanceOf(Array);
      expect(typeof data.total).toBe("number");
      expect(typeof data.took).toBe("number");
    }
  });
});

// ============================================================================
// CacheAdapter Interface Tests (2 tests)
// ============================================================================

describe("CacheAdapter interface", () => {
  interface CachedUser {
    id: string;
    name: string;
  }

  it("compiles with mock implementation", () => {
    const mockCache: CacheAdapter<CachedUser> = {
      async get(_key: string): Promise<Result<CachedUser | null, CacheError>> {
        return Result.ok(null);
      },
      async set(
        _key: string,
        _value: CachedUser,
        _ttlSeconds?: number
      ): Promise<Result<void, CacheError>> {
        return Result.ok(undefined);
      },
      async delete(_key: string): Promise<Result<boolean, CacheError>> {
        return Result.ok(false);
      },
      async clear(): Promise<Result<void, CacheError>> {
        return Result.ok(undefined);
      },
      async has(_key: string): Promise<Result<boolean, CacheError>> {
        return Result.ok(false);
      },
      async getMany(
        _keys: string[]
      ): Promise<Result<Map<string, CachedUser>, CacheError>> {
        return Result.ok(new Map());
      },
    };

    expect(typeof mockCache.get).toBe("function");
    expect(typeof mockCache.set).toBe("function");
    expect(typeof mockCache.delete).toBe("function");
    expect(typeof mockCache.clear).toBe("function");
    expect(typeof mockCache.has).toBe("function");
    expect(typeof mockCache.getMany).toBe("function");
  });

  it("returns correct types from methods", async () => {
    const cache = new Map<string, CachedUser>();

    const mockCache: CacheAdapter<CachedUser> = {
      async get(key) {
        return Result.ok(cache.get(key) ?? null);
      },
      async set(key, value, _ttlSeconds) {
        cache.set(key, value);
        return Result.ok(undefined);
      },
      async delete(key) {
        const existed = cache.has(key);
        cache.delete(key);
        return Result.ok(existed);
      },
      async clear() {
        cache.clear();
        return Result.ok(undefined);
      },
      async has(key) {
        return Result.ok(cache.has(key));
      },
      async getMany(keys) {
        const result = new Map<string, CachedUser>();
        for (const key of keys) {
          const value = cache.get(key);
          if (value) result.set(key, value);
        }
        return Result.ok(result);
      },
    };

    await mockCache.set("user:1", { id: "1", name: "Alice" });
    const getResult = await mockCache.get("user:1");

    expect(getResult.isOk()).toBe(true);
    if (getResult.isOk()) {
      const user = getResult.unwrap();
      expect(user?.id).toBe("1");
      expect(user?.name).toBe("Alice");
    }
  });
});

// ============================================================================
// AuthAdapter Interface Tests (2 tests)
// ============================================================================

describe("AuthAdapter interface", () => {
  it("compiles with mock implementation", () => {
    const mockAuth: AuthAdapter = {
      async get(
        _key: string
      ): Promise<Result<string | null, AdapterAuthError>> {
        return Result.ok(null);
      },
      async set(
        _key: string,
        _value: string
      ): Promise<Result<void, AdapterAuthError>> {
        return Result.ok(undefined);
      },
      async delete(_key: string): Promise<Result<boolean, AdapterAuthError>> {
        return Result.ok(false);
      },
      async list(): Promise<Result<string[], AdapterAuthError>> {
        return Result.ok([]);
      },
    };

    expect(typeof mockAuth.get).toBe("function");
    expect(typeof mockAuth.set).toBe("function");
    expect(typeof mockAuth.delete).toBe("function");
    expect(typeof mockAuth.list).toBe("function");
  });

  it("returns correct types from methods", async () => {
    const credentials = new Map<string, string>();

    const mockAuth: AuthAdapter = {
      async get(key) {
        return Result.ok(credentials.get(key) ?? null);
      },
      async set(key, value) {
        credentials.set(key, value);
        return Result.ok(undefined);
      },
      async delete(key) {
        const existed = credentials.has(key);
        credentials.delete(key);
        return Result.ok(existed);
      },
      async list() {
        return Result.ok([...credentials.keys()]);
      },
    };

    await mockAuth.set("github_token", "ghp_secret");
    const getResult = await mockAuth.get("github_token");

    expect(getResult.isOk()).toBe(true);
    if (getResult.isOk()) {
      expect(getResult.unwrap()).toBe("ghp_secret");
    }

    const listResult = await mockAuth.list();
    expect(listResult.isOk()).toBe(true);
    if (listResult.isOk()) {
      expect(listResult.unwrap()).toContain("github_token");
    }
  });
});

// ============================================================================
// StorageAdapter Interface Tests (2 tests)
// ============================================================================

describe("StorageAdapter interface", () => {
  it("compiles with mock implementation", () => {
    const mockStorage: StorageAdapter = {
      async read(_path: string): Promise<Result<Uint8Array, StorageError>> {
        return Result.ok(new Uint8Array());
      },
      async write(
        _path: string,
        _data: Uint8Array
      ): Promise<Result<void, StorageError>> {
        return Result.ok(undefined);
      },
      async delete(_path: string): Promise<Result<boolean, StorageError>> {
        return Result.ok(false);
      },
      async exists(_path: string): Promise<Result<boolean, StorageError>> {
        return Result.ok(false);
      },
      async list(_prefix: string): Promise<Result<string[], StorageError>> {
        return Result.ok([]);
      },
      async stat(
        _path: string
      ): Promise<
        Result<{ size: number; modifiedAt: Date } | null, StorageError>
      > {
        return Result.ok(null);
      },
    };

    expect(typeof mockStorage.read).toBe("function");
    expect(typeof mockStorage.write).toBe("function");
    expect(typeof mockStorage.delete).toBe("function");
    expect(typeof mockStorage.exists).toBe("function");
    expect(typeof mockStorage.list).toBe("function");
    expect(typeof mockStorage.stat).toBe("function");
  });

  it("returns correct types from methods", async () => {
    const files = new Map<string, Uint8Array>();
    const metadata = new Map<string, { size: number; modifiedAt: Date }>();

    const mockStorage: StorageAdapter = {
      async read(path) {
        const data = files.get(path);
        if (!data) {
          return Result.err({
            _tag: "StorageError" as const,
            message: `File not found: ${path}`,
          });
        }
        return Result.ok(data);
      },
      async write(path, data) {
        files.set(path, data);
        metadata.set(path, { size: data.length, modifiedAt: new Date() });
        return Result.ok(undefined);
      },
      async delete(path) {
        const existed = files.has(path);
        files.delete(path);
        metadata.delete(path);
        return Result.ok(existed);
      },
      async exists(path) {
        return Result.ok(files.has(path));
      },
      async list(prefix) {
        const matches = [...files.keys()].filter((k) => k.startsWith(prefix));
        return Result.ok(matches);
      },
      async stat(path) {
        return Result.ok(metadata.get(path) ?? null);
      },
    };

    // Test write
    const content = new TextEncoder().encode("Hello, World!");
    await mockStorage.write("test.txt", content);

    // Test exists
    const existsResult = await mockStorage.exists("test.txt");
    expect(existsResult.isOk()).toBe(true);
    if (existsResult.isOk()) {
      expect(existsResult.unwrap()).toBe(true);
    }

    // Test read
    const readResult = await mockStorage.read("test.txt");
    expect(readResult.isOk()).toBe(true);
    if (readResult.isOk()) {
      const text = new TextDecoder().decode(readResult.unwrap());
      expect(text).toBe("Hello, World!");
    }

    // Test stat
    const statResult = await mockStorage.stat("test.txt");
    expect(statResult.isOk()).toBe(true);
    if (statResult.isOk()) {
      const stat = statResult.unwrap();
      expect(stat?.size).toBe(content.length);
      expect(stat?.modifiedAt).toBeInstanceOf(Date);
    }
  });
});
