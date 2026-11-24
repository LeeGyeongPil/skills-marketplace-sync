import type { Config, Diagnostic, Lang, Skill } from "./types.js";
/** Agent Skills name rule: https://agentskills.io/specification (checked 2026-11-24). */
export declare const SKILL_NAME_RE: RegExp;
export interface ScanResult {
    skills: Skill[];
    diagnostics: Diagnostic[];
    /** True when the skills directory exists. */
    dirExists: boolean;
}
/** Split `---` frontmatter from a SKILL.md. Returns the YAML text and nothing else. */
export declare function extractFrontmatter(text: string): string | null;
export declare function scanSkills(root: string, config: Config, lang?: Lang): ScanResult;
