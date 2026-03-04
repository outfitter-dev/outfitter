import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import { NotFoundError, Result } from "@outfitter/contracts";

import {
  CircularExtendsError,
  deepMerge,
  ParseError,
  parseConfigFile,
} from "./parsing.js";

// ============================================================================
// Config Extends Support
// ============================================================================

/**
 * Resolve an extends path relative to the config file that contains it.
 * @internal
 */
export function resolveExtendsPath(
  extendsValue: string,
  fromFile: string
): string {
  if (isAbsolute(extendsValue)) {
    return extendsValue;
  }
  // Resolve relative to the directory containing the config file
  return resolve(dirname(fromFile), extendsValue);
}

/**
 * Load a config file and recursively resolve any extends references.
 * @internal
 */
export function loadConfigFileWithExtends(
  filePath: string,
  visited: Set<string> = new Set()
): Result<
  Record<string, unknown>,
  | InstanceType<typeof NotFoundError>
  | InstanceType<typeof ParseError>
  | InstanceType<typeof CircularExtendsError>
> {
  // Normalize path for circular detection
  const normalizedPath = resolve(filePath);

  // Check for circular reference
  if (visited.has(normalizedPath)) {
    return Result.err(
      new CircularExtendsError({
        message: `Circular extends detected: ${[...visited, normalizedPath].join(" -> ")}`,
        chain: [...visited, normalizedPath],
      })
    );
  }

  // Check file exists
  if (!existsSync(filePath)) {
    return Result.err(
      new NotFoundError({
        message: `Config file not found: ${filePath}`,
        resourceType: "config",
        resourceId: filePath,
      })
    );
  }

  // Read file
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return Result.err(
      new NotFoundError({
        message: `Failed to read config file: ${filePath}`,
        resourceType: "config",
        resourceId: filePath,
      })
    );
  }

  // Parse file
  const filename = filePath.split("/").pop() ?? "config";
  const parseResult = parseConfigFile(content, filename);

  if (parseResult.isErr()) {
    return Result.err(parseResult.error);
  }

  const parsed = parseResult.unwrap();

  // Check for extends field
  const extendsValue = parsed["extends"];
  if (extendsValue === undefined) {
    // No extends field, return parsed config as-is
    return Result.ok(parsed);
  }
  if (typeof extendsValue !== "string") {
    // extends exists but is not a string - this is an error
    return Result.err(
      new ParseError({
        message: `Invalid "extends" value in ${filePath}: expected string, got ${typeof extendsValue}`,
        filename: filePath,
      })
    );
  }

  // Mark current file as visited before recursing
  visited.add(normalizedPath);

  // Resolve the extends path
  const extendsPath = resolveExtendsPath(extendsValue, filePath);

  // Recursively load the base config
  const baseResult = loadConfigFileWithExtends(extendsPath, visited);

  if (baseResult.isErr()) {
    return Result.err(baseResult.error);
  }

  // Merge: base config <- current config (current overrides base)
  const baseConfig = baseResult.unwrap();
  const { extends: __, ...currentConfig } = parsed;

  return Result.ok(deepMerge(baseConfig, currentConfig));
}
