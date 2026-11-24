import fs from "node:fs";
import path from "node:path";
import { LineCounter, isMap, isScalar, parseDocument } from "yaml";
import { globToRegExp } from "./config.js";
import { t } from "./i18n.js";
/** Agent Skills name rule: https://agentskills.io/specification (checked 2026-11-24). */
export const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Split `---` frontmatter from a SKILL.md. Returns the YAML text and nothing else. */
export function extractFrontmatter(text) {
    const lines = text.replace(/^﻿/, "").split(/\r?\n/);
    if (lines[0]?.trimEnd() !== "---")
        return null;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trimEnd() === "---")
            return lines.slice(1, i).join("\n");
    }
    return null;
}
/** 1-based file line of a top-level frontmatter key (the YAML text starts on file line 2). */
function keyLine(doc, lc, key) {
    const contents = doc.contents;
    if (isMap(contents)) {
        for (const pair of contents.items) {
            if (isScalar(pair.key) && pair.key.value === key && pair.key.range) {
                return lc.linePos(pair.key.range[0]).line + 1;
            }
        }
    }
    return 2;
}
/** True for directories and for symlinks that point to a directory (broken links are skipped). */
function isDirectoryFollowingLinks(p) {
    try {
        return fs.statSync(p).isDirectory();
    }
    catch {
        return false;
    }
}
export function scanSkills(root, config, lang = "en") {
    const diagnostics = [];
    const skills = [];
    const base = path.join(root, config.skillsDir);
    if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) {
        return { skills, diagnostics, dirExists: false };
    }
    const excludes = config.exclude.map(globToRegExp);
    const dirs = fs
        .readdirSync(base, { withFileTypes: true })
        .filter((d) => !d.name.startsWith(".") && isDirectoryFollowingLinks(path.join(base, d.name)))
        .map((d) => d.name)
        .sort();
    for (const dir of dirs) {
        if (excludes.some((re) => re.test(dir)))
            continue;
        const rel = `${config.skillsDir}/${dir}/SKILL.md`;
        const full = path.join(root, rel);
        if (!fs.existsSync(full))
            continue;
        const add = (code, level, line, params) => diagnostics.push({ code, level, file: rel, line, message: t(lang, code, params) });
        const front = extractFrontmatter(fs.readFileSync(full, "utf8"));
        if (front === null) {
            add("SMS-E001", "error", 1, { detail: t(lang, "detail.noFrontmatter") });
            continue;
        }
        const lc = new LineCounter();
        const doc = parseDocument(front, { lineCounter: lc });
        if (doc.errors.length > 0) {
            const errLine = (doc.errors[0].linePos?.[0].line ?? 1) + 1;
            add("SMS-E001", "error", errLine, { detail: doc.errors[0].message.split("\n")[0] });
            continue;
        }
        const data = doc.toJS();
        if (typeof data !== "object" || data === null || Array.isArray(data)) {
            add("SMS-E001", "error", 2, { detail: t(lang, "detail.noFrontmatter") });
            continue;
        }
        const fm = data;
        let valid = true;
        const name = fm.name === undefined || fm.name === null ? "" : String(fm.name);
        if (name.length < 1 || name.length > 64 || !SKILL_NAME_RE.test(name)) {
            add("SMS-E002", "error", keyLine(doc, lc, "name"), { name });
            valid = false;
        }
        else if (name !== dir) {
            add("SMS-E003", "error", keyLine(doc, lc, "name"), { name, dir });
            valid = false;
        }
        const description = typeof fm.description === "string" ? fm.description.trim() : "";
        if (description.length < 1 || description.length > 1024) {
            add("SMS-E004", "error", fm.description === undefined ? 2 : keyLine(doc, lc, "description"), {
                length: description.length,
            });
            valid = false;
        }
        if (fm.compatibility !== undefined && (typeof fm.compatibility !== "string" || fm.compatibility.length > 500)) {
            add("SMS-E005", "error", keyLine(doc, lc, "compatibility"), {
                field: "compatibility",
                detail: t(lang, "detail.compat"),
            });
            valid = false;
        }
        if (fm.metadata !== undefined) {
            const m = fm.metadata;
            const ok = typeof m === "object" &&
                m !== null &&
                !Array.isArray(m) &&
                Object.values(m).every((v) => typeof v === "string");
            if (!ok) {
                add("SMS-E005", "error", keyLine(doc, lc, "metadata"), { field: "metadata", detail: t(lang, "detail.metadata") });
                valid = false;
            }
        }
        skills.push({ dir, file: rel, name, description, valid });
    }
    return { skills, diagnostics, dirExists: true };
}
