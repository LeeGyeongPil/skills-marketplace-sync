/** Deterministic JSON: 2-space indent, key order exactly as built, one trailing newline. */
export function serialize(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}
