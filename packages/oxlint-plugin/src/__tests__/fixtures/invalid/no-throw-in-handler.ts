/**
 * Multiple throw patterns that should all be reported.
 */
export function handleRequest(input: unknown) {
  if (!input) {
    throw new Error("Input is required");
  }

  return { ok: true, value: input };
}

export function handleValidation(data: Record<string, unknown>) {
  const name = data["name"];
  if (typeof name !== "string") {
    throw new TypeError("name must be a string");
  }

  if (name.length === 0) {
    throw "name cannot be empty";
  }

  return { ok: true, value: { name } };
}

export function handleLookup(id: string) {
  const error = new RangeError(`ID ${id} out of range`);
  throw error;
}
