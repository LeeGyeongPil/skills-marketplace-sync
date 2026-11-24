import { t } from "./i18n.js";
import type { Config, Diagnostic, JsonObject, Lang } from "./types.js";
/**
 * Reserved marketplace names.
 * Source: https://code.claude.com/docs/en/plugins/marketplace-reference.md "Reserved names" (checked 2026-11-24).
 */
export declare const RESERVED_MARKETPLACE_NAMES: readonly string[];
/** Codex plugin name pattern from https://agent-plugins.org/schemas/1.0.0/plugin.schema.json (checked 2026-11-24). */
export declare const CODEX_NAME_RE: RegExp;
type Detail = Parameters<typeof t>[1];
/** Returns a message key describing why a marketplace name is refused, or null when it is fine. */
export declare function marketplaceNameProblem(name: string): Detail | null;
export interface ManifestInfo {
    /** Repo-relative path of the manifest. */
    path: string;
    /** Merged manifest object (what sync would write). */
    value: JsonObject;
    /** Text used for line lookups: the committed file if present, otherwise the generated one. */
    text: string;
}
export interface RuleInput {
    root: string;
    configFile: string;
    config: Config;
    lang: Lang;
    claude: ManifestInfo;
    codex?: ManifestInfo;
}
/** Manifest- and config-level rules (the per-skill rules live in skills.ts). */
export declare function checkManifests(input: RuleInput): Diagnostic[];
export {};
