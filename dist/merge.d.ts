import type { Json, JsonObject } from "./types.js";
/** What the generator owns: top-level keys and the managed plugin entries. */
export interface Generated {
    top: JsonObject;
    entries: JsonObject[];
}
export interface MergeSpec {
    topOrder: string[];
    entryOrder: string[];
    isManaged: (entry: JsonObject) => boolean;
}
export declare function isObject(value: Json | undefined): value is JsonObject;
/**
 * Merge generated keys into the committed manifest:
 * - managed keys are overwritten, everything else a human added is kept;
 * - managed entries come first sorted by name, unmanaged entries follow in their old order;
 * - managed entries whose skill is gone are dropped (reported in `removed`).
 */
export declare function mergeManifest(generated: Generated, existing: JsonObject | null, spec: MergeSpec): {
    value: JsonObject;
    removed: string[];
};
