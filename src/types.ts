/** Shared types for skills-marketplace-sync. */

export type Level = "error" | "warning";

/** One finding. `code` is stable (SMS-E001 ...); `message` is already localized. */
export interface Diagnostic {
  code: string;
  level: Level;
  file: string;
  line?: number;
  message: string;
}

export type Mode = "bundle" | "per-skill";
export type Target = "claude" | "codex";
export type Lang = "en" | "ko";
export type Command = "init" | "sync" | "check" | "validate";
export type ClaudeValidate = "auto" | "true" | "false";

export interface Config {
  name: string;
  owner: { name: string; email?: string; url?: string };
  description?: string;
  mode: Mode;
  targets: Target[];
  skillsDir: string;
  exclude: string[];
  plugin: { name: string; description?: string };
  codex: {
    displayName: string;
    category: string;
    policy: { installation: string; authentication: string };
  };
  /** 1-based line of the `name:` key in the config file (for diagnostics). */
  nameLine?: number;
}

export interface Skill {
  /** Folder name under skillsDir. */
  dir: string;
  /** Repo-relative path of SKILL.md (POSIX separators). */
  file: string;
  name: string;
  description: string;
  /** False when a rule violation means the skill must stay out of the manifests. */
  valid: boolean;
}

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export interface ManifestOutput {
  /** Repo-relative path, e.g. .claude-plugin/marketplace.json */
  path: string;
  /** Exact bytes that should be on disk. */
  content: string;
  /** Bytes currently on disk, or null when the file does not exist. */
  existing: string | null;
  /** Names of managed entries that were dropped because their skill folder is gone. */
  removed: string[];
}

export interface DriftEntry {
  path: string;
  diff: string;
}

export interface RunOptions {
  cwd?: string;
  config?: string;
  claudeValidate?: ClaudeValidate;
  lang?: Lang;
}

export interface RunResult {
  exitCode: 0 | 1;
  command: Command;
  diagnostics: Diagnostic[];
  drift: DriftEntry[];
  /** Files written by `sync` (repo-relative). */
  written: string[];
  /** Skill names included in the manifests. */
  skills: string[];
  /** Informational lines (removed entries, claude validate output ...). */
  notes: string[];
  lang: Lang;
}

/** Thrown for usage/configuration problems (exit code 2). */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}
