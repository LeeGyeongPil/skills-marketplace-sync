import type { RunResult } from "./types.js";
/** One `::error file=…,line=…,title=CODE::message` line per diagnostic and per drifted file. */
export declare function annotations(result: RunResult): string[];
export declare function formatText(result: RunResult): string;
export declare function formatJson(result: RunResult): string;
/** Append `drift=` and `errors=` to the file named by $GITHUB_OUTPUT (used by action.yml). */
export declare function writeGithubOutput(file: string | undefined, result: RunResult): void;
