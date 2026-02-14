import { describe, expect, test } from "bun:test";
import { loadSkillSpec } from "../_shared.ts";

describe("loadSkillSpec", () => {
  test("loads and parses spec successfully", () => {
    const spec = loadSkillSpec();
    expect(spec).toBeDefined();
    expect(typeof spec).toBe("object");
  });

  test("extracts name pattern as regex", () => {
    const spec = loadSkillSpec();
    expect(spec.namePattern).toBeInstanceOf(RegExp);
    expect(spec.namePattern.test("valid-name")).toBe(true);
    expect(spec.namePattern.test("INVALID")).toBe(false);
    expect(spec.namePattern.test("also_invalid")).toBe(false);
  });

  test("extracts name length limits", () => {
    const spec = loadSkillSpec();
    expect(spec.nameMinLength).toBe(2);
    expect(spec.nameMaxLength).toBe(64);
  });

  test("extracts reserved words", () => {
    const spec = loadSkillSpec();
    expect(spec.reservedWords).toEqual(["anthropic", "claude"]);
  });

  test("extracts description length limits", () => {
    const spec = loadSkillSpec();
    expect(spec.minDescriptionLength).toBe(10);
    expect(spec.maxDescriptionLength).toBe(1024);
  });

  test("extracts max lines", () => {
    const spec = loadSkillSpec();
    expect(spec.maxLines).toBe(500);
  });

  test("extracts base fields from properties", () => {
    const spec = loadSkillSpec();
    expect(spec.baseFields).toBeInstanceOf(Set);
    expect(spec.baseFields.has("name")).toBe(true);
    expect(spec.baseFields.has("description")).toBe(true);
    expect(spec.baseFields.has("license")).toBe(true);
    expect(spec.baseFields.has("compatibility")).toBe(true);
    expect(spec.baseFields.has("metadata")).toBe(true);
    // Should not include claude extension fields
    expect(spec.baseFields.has("allowed-tools")).toBe(false);
  });

  test("extracts claude extension fields", () => {
    const spec = loadSkillSpec();
    expect(spec.claudeFields).toBeInstanceOf(Set);
    expect(spec.claudeFields.has("allowed-tools")).toBe(true);
    expect(spec.claudeFields.has("user-invocable")).toBe(true);
    expect(spec.claudeFields.has("disable-model-invocation")).toBe(true);
    expect(spec.claudeFields.has("context")).toBe(true);
    expect(spec.claudeFields.has("agent")).toBe(true);
    expect(spec.claudeFields.has("model")).toBe(true);
    expect(spec.claudeFields.has("hooks")).toBe(true);
    expect(spec.claudeFields.has("argument-hint")).toBe(true);
    // Should not include base fields
    expect(spec.claudeFields.has("name")).toBe(false);
  });

  test("extracts required fields", () => {
    const spec = loadSkillSpec();
    expect(spec.requiredFields).toEqual(["name", "description"]);
  });

  test("extracts claude recommended fields", () => {
    const spec = loadSkillSpec();
    expect(spec.claudeRecommendedFields).toEqual(["allowed-tools"]);
  });

  test("limits are numbers within sane ranges", () => {
    const spec = loadSkillSpec();
    expect(spec.nameMinLength).toBeGreaterThan(0);
    expect(spec.nameMaxLength).toBeGreaterThan(spec.nameMinLength);
    expect(spec.minDescriptionLength).toBeGreaterThan(0);
    expect(spec.maxDescriptionLength).toBeGreaterThan(
      spec.minDescriptionLength
    );
    expect(spec.maxLines).toBeGreaterThan(0);
  });

  test("returns same instance on repeated calls (cached)", () => {
    const spec1 = loadSkillSpec();
    const spec2 = loadSkillSpec();
    expect(spec1).toBe(spec2);
  });
});
