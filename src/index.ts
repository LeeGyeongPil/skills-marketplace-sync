import fs from "node:fs";
import path from "node:path";
import { runClaudeValidate } from "./claude-validate.js";
import { DEFAULT_CONFIG_FILE, loadConfig } from "./config.js";
import { unifiedDiff } from "./diff.js";
import {
  CLAUDE_ENTRY_ORDER, CLAUDE_MANIFEST_PATH, CLAUDE_TOP_ORDER, generateClaude, isClaudeManaged,
} from "./generate/claude.js";
import {
  CODEX_ENTRY_ORDER, CODEX_MANIFEST_PATH, CODEX_TOP_ORDER, generateCodex, isCodexManaged,
} from "./generate/codex.js";
import { t, resolveLang } from "./i18n.js";
import { isObject, mergeManifest } from "./merge.js";
import { checkManifests, marketplaceNameProblem } from "./rules.js";
import type { ManifestInfo } from "./rules.js";
import { serialize } from "./serialize.js";
import { scanSkills } from "./skills.js";
import type { ScanResult } from "./skills.js";
import type {
  Command, Config, DriftEntry, JsonObject, Lang, ManifestOutput, RunOptions, RunResult,
} from "./types.js";
import { UsageError } from "./types.js";

export { loadConfig, scanSkills, resolveLang, serialize, unifiedDiff, UsageError };
export type { Config, Diagnostic, RunOptions, RunResult, ManifestOutput } from "./types.js";

/** CRLF checkouts (core.autocrlf) must not count as drift. */
function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function readIfExists(file: string): string | null {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

function parseExisting(text: string | null, file: string, lang: Lang): JsonObject | null {
  if (text === null) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (!isObject(value as never)) throw new Error("top level must be an object");
    return value as JsonObject;
  } catch (error) {
    throw new UsageError(t(lang, "err.manifestParse", { file, detail: (error as Error).message }));
  }
}

/**
 * Build the exact bytes of every manifest the config asks for, merged into what is already committed.
 * `existing` maps a repo-relative manifest path to its current text (or null).
 */
export function buildManifests(
  scan: ScanResult,
  config: Config,
  existing: Record<string, string | null>,
  lang: Lang = "en",
): ManifestOutput[] {
  const outputs: ManifestOutput[] = [];

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
export function run(command: Exclude<Command, "init">, options: RunOptions = {}): RunResult {
  const root = path.resolve(options.cwd ?? ".");
  const lang = options.lang ?? resolveLang(undefined);
  if (!fs.existsSync(root)) throw new UsageError(t(lang, "err.cwd", { dir: root }));
  const configFile = options.config ?? DEFAULT_CONFIG_FILE;
  const config = loadConfig(root, configFile, lang);

  const scan = scanSkills(root, config, lang);
  const existing: Record<string, string | null> = {
    [CLAUDE_MANIFEST_PATH]: readIfExists(path.join(root, CLAUDE_MANIFEST_PATH)),
    [CODEX_MANIFEST_PATH]: readIfExists(path.join(root, CODEX_MANIFEST_PATH)),
  };
  const outputs = buildManifests(scan, config, existing, lang);
  const skillNames = scan.skills.filter((s) => s.valid).map((s) => s.name).sort();

  const infos: ManifestInfo[] = outputs.map((o) => ({
    path: o.path,
    value: JSON.parse(o.content) as JsonObject,
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

  const notes: string[] = [];
  const written: string[] = [];
  const drift: DriftEntry[] = [];
  const count = skillNames.length;
  if (!scan.dirExists) notes.push(t(lang, "out.noSkills", { dir: config.skillsDir }));

  for (const out of outputs) {
    if (command === "sync") {
      for (const name of out.removed) notes.push(t(lang, "out.removed", { name, path: out.path }));
      if (out.content !== out.existing) {
        const target = path.join(root, out.path);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, out.content);
        written.push(out.path);
        notes.push(t(lang, "out.wrote", { path: out.path, count }));
      } else {
        notes.push(t(lang, "out.unchanged", { path: out.path }));
      }
    } else if (command === "check") {
      if (out.existing != null && normalizeEol(out.content) === normalizeEol(out.existing)) {
        notes.push(t(lang, "out.okUpToDate", { path: out.path, count }));
      } else {
        notes.push(t(lang, "out.drift", { path: out.path }));
        drift.push({ path: out.path, diff: unifiedDiff(out.existing ?? "", out.content, `a/${out.path}`, `b/${out.path}`) });
      }
    }
  }

  let claudeFailed = false;
  if (fs.existsSync(path.join(root, CLAUDE_MANIFEST_PATH))) {
    const validated = runClaudeValidate(root, options.claudeValidate ?? "auto", lang);
    if (validated.status === "ok") notes.push(t(lang, "out.claudeOk"));
    else if (validated.status === "failed") {
      claudeFailed = true;
      notes.push(t(lang, "out.claudeFail"), validated.output);
    } else if (validated.output) notes.push(validated.output);
  }

  const errors = diagnostics.filter((d) => d.level === "error").length;
  if (command === "validate" && errors === 0) notes.push(t(lang, "out.valid", { count }));

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
export function initConfig(
  options: RunOptions & { name?: string; owner?: string; mode?: string; targets?: string },
): { file: string } {
  const lang = options.lang ?? resolveLang(undefined);
  const root = path.resolve(options.cwd ?? ".");
  if (!fs.existsSync(root)) throw new UsageError(t(lang, "err.cwd", { dir: root }));
  const configFile = options.config ?? DEFAULT_CONFIG_FILE;
  const target = path.join(root, configFile);
  if (!options.name) throw new UsageError(t(lang, "init.needName"));
  if (!options.owner) throw new UsageError(t(lang, "init.needOwner"));
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
  if (fs.existsSync(target)) throw new UsageError(t(lang, "init.exists", { file: configFile }));

  const body = [
    `name: ${JSON.stringify(options.name)}`,
    `owner: { name: ${JSON.stringify(options.owner)} }`,
    `description: ${JSON.stringify(`Agent skills from ${options.name}`)}`,
    `mode: ${mode}`,
    `targets: [${targets.join(", ")}]`,
    "",
  ].join("\n");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body);
  return { file: configFile };
}
