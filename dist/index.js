import fs from "node:fs";
import path from "node:path";
import { runClaudeValidate } from "./claude-validate.js";
import { DEFAULT_CONFIG_FILE, loadConfig } from "./config.js";
import { unifiedDiff } from "./diff.js";
import { CLAUDE_ENTRY_ORDER, CLAUDE_MANIFEST_PATH, CLAUDE_TOP_ORDER, generateClaude, isClaudeManaged, } from "./generate/claude.js";
import { CODEX_ENTRY_ORDER, CODEX_MANIFEST_PATH, CODEX_TOP_ORDER, generateCodex, isCodexManaged, } from "./generate/codex.js";
import { t, resolveLang } from "./i18n.js";
import { isObject, mergeManifest } from "./merge.js";
import { checkManifests, marketplaceNameProblem } from "./rules.js";
import { serialize } from "./serialize.js";
import { scanSkills } from "./skills.js";
import { UsageError } from "./types.js";
export { loadConfig, scanSkills, resolveLang, serialize, unifiedDiff, UsageError };
/** CRLF checkouts (core.autocrlf) must not count as drift. */
function normalizeEol(text) {
    return text.replace(/\r\n/g, "\n");
}
/** 파일 쓰기 실패(권한·읽기 전용·디스크 부족)를 스택 대신 사용 오류(exit 2)로 바꾼다. */
const WRITE_ERRORS = new Set(["EACCES", "EPERM", "EROFS", "ENOSPC", "EISDIR", "ENOTDIR"]);
function writeFile(target, body, lang) {
    try {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, body);
    }
    catch (error) {
        const code = error.code ?? "";
        if (WRITE_ERRORS.has(code))
            throw new UsageError(t(lang, "err.write", { file: target, code }));
        throw error;
    }
}
function readIfExists(file) {
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}
function parseExisting(text, file, lang) {
    if (text === null)
        return null;
    try {
        const value = JSON.parse(text);
        if (!isObject(value))
            throw new Error("top level must be an object");
        return value;
    }
    catch (error) {
        throw new UsageError(t(lang, "err.manifestParse", { file, detail: error.message }));
    }
}
/**
 * Build the exact bytes of every manifest the config asks for, merged into what is already committed.
 * `existing` maps a repo-relative manifest path to its current text (or null).
 */
export function buildManifests(scan, config, existing, lang = "en") {
    const outputs = [];
    const claudeOld = existing[CLAUDE_MANIFEST_PATH] ?? null;
    const claude = mergeManifest(generateClaude(scan.skills, config), parseExisting(claudeOld, CLAUDE_MANIFEST_PATH, lang), {
        topOrder: CLAUDE_TOP_ORDER,
        entryOrder: CLAUDE_ENTRY_ORDER,
        isManaged: (e) => isClaudeManaged(e, config),
    });
    outputs.push({ path: CLAUDE_MANIFEST_PATH, content: serialize(claude.value), existing: claudeOld, removed: claude.removed });
    if (config.targets.includes("codex")) {
        const codexOld = existing[CODEX_MANIFEST_PATH] ?? null;
        const codex = mergeManifest(generateCodex(config), parseExisting(codexOld, CODEX_MANIFEST_PATH, lang), {
            topOrder: CODEX_TOP_ORDER,
            entryOrder: CODEX_ENTRY_ORDER,
            isManaged: (e) => isCodexManaged(e, config),
        });
        outputs.push({ path: CODEX_MANIFEST_PATH, content: serialize(codex.value), existing: codexOld, removed: codex.removed });
    }
    return outputs;
}
/** Run sync, check or validate. Throws UsageError for usage/config problems (exit code 2). */
export function run(command, options = {}) {
    const root = path.resolve(options.cwd ?? ".");
    const lang = options.lang ?? resolveLang(undefined);
    if (!fs.existsSync(root))
        throw new UsageError(t(lang, "err.cwd", { dir: root }));
    const configFile = options.config ?? DEFAULT_CONFIG_FILE;
    const config = loadConfig(root, configFile, lang);
    const scan = scanSkills(root, config, lang);
    const existing = {
        [CLAUDE_MANIFEST_PATH]: readIfExists(path.join(root, CLAUDE_MANIFEST_PATH)),
        [CODEX_MANIFEST_PATH]: readIfExists(path.join(root, CODEX_MANIFEST_PATH)),
    };
    const outputs = buildManifests(scan, config, existing, lang);
    const skillNames = scan.skills.filter((s) => s.valid).map((s) => s.name).sort();
    const infos = outputs.map((o) => ({
        path: o.path,
        value: JSON.parse(o.content),
        text: o.existing ?? o.content,
    }));
    const diagnostics = [
        ...scan.diagnostics,
        ...checkManifests({
            root,
            configFile,
            config,
            lang,
            claude: infos[0],
            codex: infos[1],
        }),
    ];
    const notes = [];
    const written = [];
    const drift = [];
    const count = skillNames.length;
    if (!scan.dirExists)
        notes.push(t(lang, "out.noSkills", { dir: config.skillsDir }));
    for (const out of outputs) {
        if (command === "sync") {
            for (const name of out.removed)
                notes.push(t(lang, "out.removed", { name, path: out.path }));
            if (out.content !== out.existing) {
                const target = path.join(root, out.path);
                writeFile(target, out.content, lang);
                written.push(out.path);
                notes.push(t(lang, "out.wrote", { path: out.path, count }));
            }
            else {
                notes.push(t(lang, "out.unchanged", { path: out.path }));
            }
        }
        else if (command === "check") {
            if (out.existing != null && normalizeEol(out.content) === normalizeEol(out.existing)) {
                notes.push(t(lang, "out.okUpToDate", { path: out.path, count }));
            }
            else {
                notes.push(t(lang, "out.drift", { path: out.path }));
                drift.push({ path: out.path, diff: unifiedDiff(out.existing ?? "", out.content, `a/${out.path}`, `b/${out.path}`) });
            }
        }
    }
    let claudeFailed = false;
    if (fs.existsSync(path.join(root, CLAUDE_MANIFEST_PATH))) {
        const validated = runClaudeValidate(root, options.claudeValidate ?? "auto", lang);
        if (validated.status === "ok")
            notes.push(t(lang, "out.claudeOk"));
        else if (validated.status === "failed") {
            claudeFailed = true;
            notes.push(t(lang, "out.claudeFail"), validated.output);
        }
        else if (validated.output)
            notes.push(validated.output);
    }
    const errors = diagnostics.filter((d) => d.level === "error").length;
    if (command === "validate" && errors === 0)
        notes.push(t(lang, "out.valid", { count }));
    return {
        exitCode: errors > 0 || drift.length > 0 || claudeFailed ? 1 : 0,
        command,
        diagnostics,
        drift,
        written,
        skills: skillNames,
        notes,
        lang,
    };
}
/** `init`: write a starter skills-marketplace.yml. */
export function initConfig(options) {
    const lang = options.lang ?? resolveLang(undefined);
    const root = path.resolve(options.cwd ?? ".");
    if (!fs.existsSync(root))
        throw new UsageError(t(lang, "err.cwd", { dir: root }));
    const configFile = options.config ?? DEFAULT_CONFIG_FILE;
    const target = path.join(root, configFile);
    if (!options.name)
        throw new UsageError(t(lang, "init.needName"));
    if (!options.owner)
        throw new UsageError(t(lang, "init.needOwner"));
    const problem = marketplaceNameProblem(options.name);
    if (problem) {
        throw new UsageError(t(lang, "SMS-E007", { name: options.name, detail: t(lang, problem) }));
    }
    const mode = options.mode ?? "bundle";
    if (mode !== "bundle" && mode !== "per-skill") {
        throw new UsageError(t(lang, "err.badValue", { value: mode, option: "--mode", allowed: "bundle, per-skill" }));
    }
    const targets = (options.targets ?? "claude").split(",").map((s) => s.trim()).filter(Boolean);
    for (const target of targets) {
        if (target !== "claude" && target !== "codex") {
            throw new UsageError(t(lang, "err.badValue", { value: target, option: "--targets", allowed: "claude, codex" }));
        }
    }
    if (fs.existsSync(target))
        throw new UsageError(t(lang, "init.exists", { file: configFile }));
    const body = [
        `name: ${JSON.stringify(options.name)}`,
        `owner: { name: ${JSON.stringify(options.owner)} }`,
        `description: ${JSON.stringify(`Agent skills from ${options.name}`)}`,
        `mode: ${mode}`,
        `targets: [${targets.join(", ")}]`,
        "",
    ].join("\n");
    writeFile(target, body, lang);
    return { file: configFile };
}
