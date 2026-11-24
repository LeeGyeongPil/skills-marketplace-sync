import type { Config, JsonObject, Skill } from "../types.js";
import type { Generated } from "../merge.js";

export const CLAUDE_MANIFEST_PATH = ".claude-plugin/marketplace.json";

/** Key order for the Claude marketplace file and its entries. */
export const CLAUDE_TOP_ORDER = ["$schema", "name", "owner", "description", "version", "metadata", "plugins"];
export const CLAUDE_ENTRY_ORDER = ["name", "source", "strict", "description", "version", "skills"];

/** The keys this tool owns in .claude-plugin/marketplace.json. */
export function generateClaude(skills: Skill[], config: Config): Generated {
  const top: JsonObject = { name: config.name, owner: { ...config.owner } };
  if (config.description !== undefined) top.description = config.description;

  const valid = skills.filter((s) => s.valid);
  if (config.mode === "per-skill") {
    return {
      top,
      entries: valid.map((s) => ({
        name: s.name,
        source: `./${config.skillsDir}/${s.dir}`,
        description: s.description,
      })),
    };
  }
  const entry: JsonObject = { name: config.plugin.name, source: "./", strict: false };
  if (config.plugin.description !== undefined) entry.description = config.plugin.description;
  entry.skills = valid.map((s) => `./${config.skillsDir}/${s.dir}`).sort();
  return { top, entries: [entry] };
}

/** Is this existing entry one the tool manages (and may rewrite or remove)? */
export function isClaudeManaged(entry: JsonObject, config: Config): boolean {
  if (config.mode === "bundle") return entry.name === config.plugin.name;
  return typeof entry.source === "string" && entry.source.startsWith(`./${config.skillsDir}/`);
}
