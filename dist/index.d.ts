import { loadConfig } from "./config.js";
import { unifiedDiff } from "./diff.js";
import { resolveLang } from "./i18n.js";
import { serialize } from "./serialize.js";
import { scanSkills } from "./skills.js";
import type { ScanResult } from "./skills.js";
import type { Command, Config, Lang, ManifestOutput, RunOptions, RunResult } from "./types.js";
import { UsageError } from "./types.js";
export { loadConfig, scanSkills, resolveLang, serialize, unifiedDiff, UsageError };
export type { Config, Diagnostic, RunOptions, RunResult, ManifestOutput } from "./types.js";
/**
 * Build the exact bytes of every manifest the config asks for, merged into what is already committed.
 * `existing` maps a repo-relative manifest path to its current text (or null).
 */
export declare function buildManifests(scan: ScanResult, config: Config, existing: Record<string, string | null>, lang?: Lang): ManifestOutput[];
/** Run sync, check or validate. Throws UsageError for usage/config problems (exit code 2). */
export declare function run(command: Exclude<Command, "init">, options?: RunOptions): RunResult;
/** `init`: write a starter skills-marketplace.yml. */
export declare function initConfig(options: RunOptions & {
    name?: string;
    owner?: string;
    mode?: string;
    targets?: string;
}): {
    file: string;
};
