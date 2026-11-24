import fs from "node:fs";
import path from "node:path";
import { isObject } from "./merge.js";
import { t } from "./i18n.js";
import { CODEX_AUTHENTICATION, CODEX_INSTALLATION } from "./generate/codex.js";
import type { Config, Diagnostic, Json, JsonObject, Lang } from "./types.js";

/**
 * Reserved marketplace names.
 * Source: https://code.claude.com/docs/en/plugins/marketplace-reference.md "Reserved names" (checked 2026-11-24).
 */
export const RESERVED_MARKETPLACE_NAMES: readonly string[] = [
  "claude-code-marketplace", "claude-code-plugins", "claude-plugins-official", "anthropic-marketplace",
  "anthropic-plugins", "agent-skills", "anthropic-agent-skills", "life-sciences", "knowledge-work-plugins",
  "claude-for-legal", "claude-for-financial-services", "financial-services-plugins", "first-party-plugins",
  "claude-tag-plugins", "claude-community", "claude-plugins-community", "healthcare",
  "anthropic-plugin-directory", "claude-plugin-directory",
  "inline", "builtin", "skills-dir", "synced", "claude-plugin-test",
  "constructor", "hasownproperty", "isprototypeof", "propertyisenumerable", "tolocalestring", "tostring", "valueof",
];

/** Codex plugin name pattern from https://agent-plugins.org/schemas/1.0.0/plugin.schema.json (checked 2026-11-24). */
export const CODEX_NAME_RE = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

type Detail = Parameters<typeof t>[1];

/** Returns a message key describing why a marketplace name is refused, or null when it is fine. */
export function marketplaceNameProblem(name: string): Detail | null {
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/.test(name)) return "detail.control";
  if (/[^\u0000-\u007f]/.test(name)) return "detail.nonAscii";
  if (name.toLowerCase().startsWith("claudeai-")) return "detail.claudeaiPrefix";
  const lower = name.toLowerCase();
  // `claude.code.plugins` counts as `claude-code-plugins`: trailing dot or a non-underscore symbol for a hyphen
  const spelling = lower.replace(/\.+$/, "").replace(/[^a-z0-9_]/g, "-");
  if (RESERVED_MARKETPLACE_NAMES.includes(lower) || RESERVED_MARKETPLACE_NAMES.includes(spelling)) {
    return "detail.reserved";
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) || name.includes("..")) return "detail.chars";
  return null;
}

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

function findLine(text: string, needle: string): number | undefined {
  const lines = text.split("\n");
  const idx = lines.findIndex((l) => l.includes(needle));
  return idx >= 0 ? idx + 1 : undefined;
}

function pluginEntries(value: JsonObject): JsonObject[] {
  return Array.isArray(value.plugins) ? (value.plugins as Json[]).filter(isObject) : [];
}

/** Manifest- and config-level rules (the per-skill rules live in skills.ts). */
export function checkManifests(input: RuleInput): Diagnostic[] {
  const { root, configFile, config, lang, claude, codex } = input;
  const out: Diagnostic[] = [];
  const add = (
    code: string,
    level: "error" | "warning",
    file: string,
    line: number | undefined,
    params: Record<string, string | number> = {},
  ) => out.push({ code, level, file, line, message: t(lang, code as "SMS-E006", params) });

  // E007 marketplace name
  const problem = marketplaceNameProblem(config.name);
  if (problem) add("SMS-E007", "error", configFile, config.nameLine, { name: config.name, detail: t(lang, problem) });

  // E006 duplicates + E008 sources + W003 engines + W002 version in every manifest we know
  for (const manifest of [claude, ...(codex ? [codex] : [])]) {
    const seen = new Set<string>();
    for (const entry of pluginEntries(manifest.value)) {
      const name = String(entry.name);
      if (seen.has(name)) {
        add("SMS-E006", "error", manifest.path, findLine(manifest.text, `"name": "${name}"`), { name, file: manifest.path });
      }
      seen.add(name);
    }
  }
  for (const entry of pluginEntries(claude.value)) {
    const name = String(entry.name);
    const source = entry.source;
    if (typeof source === "string") {
      const line = findLine(claude.text, `"${source}"`);
      const bad = (key: Detail) => add("SMS-E008", "error", claude.path, line, { source, detail: t(lang, key) });
      if (!source.startsWith("./") && source !== ".") bad("detail.sourcePrefix");
      else if (source.split("/").includes("..")) bad("detail.sourceDotDot");
      else if (!fs.existsSync(path.resolve(root, source))) bad("detail.sourceMissing");
      else {
        const pj = path.resolve(root, source, ".claude-plugin", "plugin.json");
        if (entry.version !== undefined && fs.existsSync(pj)) {
          try {
            const manifestVersion = (JSON.parse(fs.readFileSync(pj, "utf8")) as JsonObject).version;
            if (typeof manifestVersion === "string") {
              add("SMS-W002", "warning", claude.path, findLine(claude.text, `"name": "${name}"`), {
                name,
                entry: String(entry.version),
                file: path.posix.join(source.replace(/^\.\/?/, ""), ".claude-plugin/plugin.json"),
                manifest: manifestVersion,
              });
            }
          } catch {
            /* unreadable plugin.json is Claude's problem to report */
          }
        }
      }
    }
    if ("engines" in entry) {
      add("SMS-W003", "warning", claude.path, findLine(claude.text, '"engines"'), { name });
    }
    if (/^(claude|anthropic)-/.test(name)) {
      add("SMS-W006", "warning", claude.path, findLine(claude.text, `"name": "${name}"`), { name });
    }
  }

  // E009 conflicting manifests (bundle mode writes strict:false + skills)
  if (config.mode === "bundle") {
    const pj = ".claude-plugin/plugin.json";
    if (fs.existsSync(path.join(root, pj))) {
      add("SMS-E009", "error", pj, undefined, { file: pj });
    }
  }

  // E010 Codex names and policy values
  if (config.targets.includes("codex")) {
    if (!CODEX_NAME_RE.test(config.plugin.name) || config.plugin.name.length > 64) {
      add("SMS-E010", "error", configFile, undefined, {
        detail: t(lang, "detail.codexName", { name: config.plugin.name }),
      });
    }
    const { installation, authentication } = config.codex.policy;
    if (!CODEX_INSTALLATION.includes(installation)) {
      add("SMS-E010", "error", configFile, undefined, {
        detail: t(lang, "detail.codexPolicy", { key: "installation", value: installation, allowed: CODEX_INSTALLATION.join(", ") }),
      });
    }
    if (!CODEX_AUTHENTICATION.includes(authentication)) {
      add("SMS-E010", "error", configFile, undefined, {
        detail: t(lang, "detail.codexPolicy", { key: "authentication", value: authentication, allowed: CODEX_AUTHENTICATION.join(", ") }),
      });
    }
    if (config.exclude.length > 0) add("SMS-W004", "warning", configFile, undefined);
  } else if (config.mode === "per-skill") {
    add("SMS-W001", "warning", configFile, undefined);
  }

  // W005 marketplace description
  const meta = claude.value.metadata;
  const hasDescription =
    typeof claude.value.description === "string" ||
    (isObject(meta) && typeof meta.description === "string");
  if (!hasDescription) add("SMS-W005", "warning", claude.path, undefined);

  return out;
}
