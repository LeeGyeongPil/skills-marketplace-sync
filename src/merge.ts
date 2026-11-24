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

export function isObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Known keys first in a fixed order, then unknown keys in their existing relative order. */
function ordered(order: string[], managed: JsonObject, existing: JsonObject | undefined): JsonObject {
  const out: JsonObject = {};
  for (const key of order) {
    if (key in managed) out[key] = managed[key];
    else if (existing && key in existing) out[key] = existing[key];
  }
  if (existing) {
    for (const key of Object.keys(existing)) if (!(key in out)) out[key] = existing[key];
  }
  return out;
}

/**
 * Merge generated keys into the committed manifest:
 * - managed keys are overwritten, everything else a human added is kept;
 * - managed entries come first sorted by name, unmanaged entries follow in their old order;
 * - managed entries whose skill is gone are dropped (reported in `removed`).
 */
export function mergeManifest(
  generated: Generated,
  existing: JsonObject | null,
  spec: MergeSpec,
): { value: JsonObject; removed: string[] } {
  const oldPlugins: Json[] = Array.isArray(existing?.plugins) ? (existing?.plugins as Json[]) : [];
  const isManagedEntry = (p: Json): p is JsonObject => isObject(p) && spec.isManaged(p);
  const managedOld = oldPlugins.filter(isManagedEntry);
  const preserved = oldPlugins.filter((p) => !isManagedEntry(p));

  const genNames = new Set(generated.entries.map((e) => String(e.name)));
  const removed = managedOld.map((p) => String(p.name)).filter((n) => !genNames.has(n));

  const merged = generated.entries
    .map((entry) => ordered(spec.entryOrder, entry, managedOld.find((p) => p.name === entry.name)))
    .sort((a, b) => (String(a.name) < String(b.name) ? -1 : String(a.name) > String(b.name) ? 1 : 0));

  const top: JsonObject = { ...generated.top, plugins: [...merged, ...preserved] };
  // Codex `interface`: keep sub-keys a human added next to displayName.
  const oldInterface = existing?.interface;
  if (isObject(top.interface) && isObject(oldInterface)) {
    top.interface = ordered(["displayName"], top.interface, oldInterface);
  }
  return { value: ordered(spec.topOrder, top, existing ?? undefined), removed };
}
