import type { Json } from "./types.js";

/** Deterministic JSON: 2-space indent, key order exactly as built, one trailing newline. */
export function serialize(value: Json): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
