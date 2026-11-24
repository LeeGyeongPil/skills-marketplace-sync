import { spawnSync } from "node:child_process";
import { t } from "./i18n.js";
import { UsageError } from "./types.js";
/** Validation can take several seconds (about 7 s measured with Claude Code 2.1.322). */
const TIMEOUT_MS = 180_000;
function claudeAvailable() {
    const probe = spawnSync("claude", ["--version"], { encoding: "utf8", timeout: 30_000 });
    return !probe.error && probe.status === 0;
}
/** Optionally run `claude plugin validate <root> --strict` after our own rules. */
export function runClaudeValidate(root, mode, lang) {
    if (mode === "false")
        return { status: "skipped", output: "" };
    if (!claudeAvailable()) {
        if (mode === "true")
            throw new UsageError(t(lang, "out.claudeSkip"));
        return { status: "skipped", output: t(lang, "out.claudeSkip") };
    }
    const result = spawnSync("claude", ["plugin", "validate", root, "--strict"], {
        encoding: "utf8",
        timeout: TIMEOUT_MS,
    });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    return { status: result.status === 0 && !result.error ? "ok" : "failed", output };
}
