import type { Config, JsonObject, Skill } from "../types.js";
import type { Generated } from "../merge.js";
export declare const CLAUDE_MANIFEST_PATH = ".claude-plugin/marketplace.json";
/** Key order for the Claude marketplace file and its entries. */
export declare const CLAUDE_TOP_ORDER: string[];
export declare const CLAUDE_ENTRY_ORDER: string[];
/** The keys this tool owns in .claude-plugin/marketplace.json. */
export declare function generateClaude(skills: Skill[], config: Config): Generated;
/** Is this existing entry one the tool manages (and may rewrite or remove)? */
export declare function isClaudeManaged(entry: JsonObject, config: Config): boolean;
