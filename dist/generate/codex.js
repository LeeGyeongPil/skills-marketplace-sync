export const CODEX_MANIFEST_PATH = ".agents/plugins/marketplace.json";
export const CODEX_TOP_ORDER = ["name", "interface", "plugins"];
export const CODEX_ENTRY_ORDER = ["name", "source", "policy", "category"];
/** Allowed policy values (openai/plugins marketplace.json and Codex docs, checked 2026-11-24). */
export const CODEX_INSTALLATION = ["AVAILABLE", "INSTALLED_BY_DEFAULT", "NOT_AVAILABLE"];
export const CODEX_AUTHENTICATION = ["ON_INSTALL", "ON_FIRST_USE"];
/** Codex always gets one bundle entry pointing at the repo root: Codex loads skills/ from there. */
export function generateCodex(config) {
    const top = { name: config.name, interface: { displayName: config.codex.displayName } };
    const entry = {
        name: config.plugin.name,
        source: { source: "local", path: "./" },
        policy: {
            installation: config.codex.policy.installation,
            authentication: config.codex.policy.authentication,
        },
        category: config.codex.category,
    };
    return { top, entries: [entry] };
}
export function isCodexManaged(entry, config) {
    return entry.name === config.plugin.name;
}
