import type { Config, JsonObject } from "../types.js";
export declare const CODEX_MANIFEST_PATH = ".agents/plugins/marketplace.json";
export declare const CODEX_TOP_ORDER: string[];
export declare const CODEX_ENTRY_ORDER: string[];
/** Allowed policy values (openai/plugins marketplace.json and Codex docs, checked 2026-11-24). */
export declare const CODEX_INSTALLATION: string[];
export declare const CODEX_AUTHENTICATION: string[];
/** Codex always gets one bundle entry pointing at the repo root: Codex loads skills/ from there. */
export declare function generateCodex(config: Config): {
    top: JsonObject;
    entries: JsonObject[];
};
export declare function isCodexManaged(entry: JsonObject, config: Config): boolean;
