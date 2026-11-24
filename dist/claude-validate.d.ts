import type { ClaudeValidate, Lang } from "./types.js";
export interface ClaudeValidateResult {
    status: "skipped" | "ok" | "failed";
    /** Trimmed combined stdout/stderr of the claude command. */
    output: string;
}
/** Optionally run `claude plugin validate <root> --strict` after our own rules. */
export declare function runClaudeValidate(root: string, mode: ClaudeValidate, lang: Lang): ClaudeValidateResult;
