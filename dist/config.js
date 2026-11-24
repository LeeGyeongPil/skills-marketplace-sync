import fs from "node:fs";
import path from "node:path";
import { LineCounter, parseDocument } from "yaml";
import { t } from "./i18n.js";
import { UsageError } from "./types.js";
export const DEFAULT_CONFIG_FILE = "skills-marketplace.yml";
function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function optString(raw, key, file, lang) {
    const value = raw[key];
    if (value === undefined || value === null)
        return undefined;
    if (typeof value !== "string") {
        throw new UsageError(t(lang, "err.field", { file, detail: t(lang, "config.type", { key, expected: "string" }) }));
    }
    return value;
}
/** Read and validate the config file. Throws UsageError (exit code 2) on any problem. */
export function loadConfig(root, configFile = DEFAULT_CONFIG_FILE, lang = "en") {
    const file = path.resolve(root, configFile);
    const shown = configFile;
    if (!fs.existsSync(file))
        throw new UsageError(t(lang, "err.noConfig", { file: shown }));
    const text = fs.readFileSync(file, "utf8");
    const lineCounter = new LineCounter();
    const doc = parseDocument(text, { lineCounter });
    if (doc.errors.length > 0) {
        throw new UsageError(t(lang, "err.yaml", { file: shown, detail: doc.errors[0].message.split("\n")[0] }));
    }
    const raw = doc.toJS();
    if (!isObject(raw))
        throw new UsageError(t(lang, "err.yaml", { file: shown, detail: "top level must be a map" }));
    const fail = (detail) => {
        throw new UsageError(t(lang, "err.field", { file: shown, detail }));
    };
    const name = optString(raw, "name", shown, lang);
    if (!name)
        fail(t(lang, "config.requiredName"));
    const owner = raw.owner;
    if (!isObject(owner) || typeof owner.name !== "string" || owner.name === "")
        fail(t(lang, "config.requiredOwner"));
    const ownerObj = owner;
    const mode = (raw.mode ?? "bundle");
    if (mode !== "bundle" && mode !== "per-skill")
        fail(t(lang, "config.mode"));
    const targetsRaw = raw.targets ?? ["claude"];
    if (!Array.isArray(targetsRaw) ||
        targetsRaw.length === 0 ||
        !targetsRaw.every((x) => x === "claude" || x === "codex")) {
        fail(t(lang, "config.targets"));
    }
    const targets = [...new Set(targetsRaw)];
    const skillsDir = (optString(raw, "skillsDir", shown, lang) ?? "skills").replace(/^\.\//, "").replace(/\/+$/, "");
    if (targets.includes("codex") && skillsDir !== "skills") {
        throw new UsageError(t(lang, "err.codexSkillsDir", { file: shown, dir: skillsDir }));
    }
    const excludeRaw = raw.exclude ?? [];
    if (!Array.isArray(excludeRaw) || !excludeRaw.every((x) => typeof x === "string")) {
        fail(t(lang, "config.type", { key: "exclude", expected: "list of strings" }));
    }
    const pluginRaw = isObject(raw.plugin) ? raw.plugin : {};
    const codexRaw = isObject(raw.codex) ? raw.codex : {};
    const policyRaw = isObject(codexRaw.policy) ? codexRaw.policy : {};
    const nameNode = doc.get("name", true);
    const nameLine = nameNode?.range ? lineCounter.linePos(nameNode.range[0]).line : undefined;
    return {
        name: name,
        owner: {
            name: ownerObj.name,
            ...(typeof ownerObj.email === "string" ? { email: ownerObj.email } : {}),
            ...(typeof ownerObj.url === "string" ? { url: ownerObj.url } : {}),
        },
        description: optString(raw, "description", shown, lang),
        mode: mode,
        targets,
        skillsDir,
        exclude: excludeRaw,
        plugin: {
            name: optString(pluginRaw, "name", shown, lang) ?? name,
            description: optString(pluginRaw, "description", shown, lang),
        },
        codex: {
            displayName: optString(codexRaw, "displayName", shown, lang) ?? name,
            category: optString(codexRaw, "category", shown, lang) ?? "Productivity",
            policy: {
                installation: optString(policyRaw, "installation", shown, lang) ?? "AVAILABLE",
                authentication: optString(policyRaw, "authentication", shown, lang) ?? "ON_INSTALL",
            },
        },
        nameLine,
    };
}
/** Convert a folder glob (`*` and `?` only) to a RegExp. */
export function globToRegExp(glob) {
    const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
    return new RegExp(`^${escaped}$`);
}
