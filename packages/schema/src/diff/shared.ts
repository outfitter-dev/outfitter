export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => {
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });
}

export function sortedStringArrayEquals(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

export function hasOwnKey(value: object, key: PropertyKey): boolean {
  return Object.hasOwn(value, key);
}
