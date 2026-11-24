import type { Json } from "./types.js";
/** Deterministic JSON: 2-space indent, key order exactly as built, one trailing newline. */
export declare function serialize(value: Json): string;
