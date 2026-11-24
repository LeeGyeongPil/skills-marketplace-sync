// Shared helpers for the node:test suites. Tests run the built CLI in dist/.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CLI = path.join(ROOT, "dist", "cli.js");
export const FIXTURES = path.join(ROOT, "test", "fixtures");

/** Copy a fixture into a fresh temp dir so `sync` never touches the committed fixture. */
export function copyFixture(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sms-"));
  fs.cpSync(path.join(FIXTURES, name), dir, { recursive: true });
  return dir;
}

/** PATH with only the running node's folder: no claude/codex, whatever the host machine has installed. */
export const NODE_ONLY_PATH = path.dirname(process.execPath);

/**
 * Environment for child processes that does not depend on the host or CI runner.
 * - drops runner variables (CI, GITHUB_*, RUNNER_*, INPUT_*): GITHUB_ACTIONS/GITHUB_OUTPUT switch the CLI
 *   to annotation mode and would change the expected output
 * - drops locale variables and pins LANG=C.UTF-8 and TZ=UTC: messages are English unless a test asks
 * - PATH holds only node, so `--claude-validate auto` behaves the same on every machine (skipped)
 */
export function cleanEnv(extra = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key === "CI" || /^(GITHUB_|RUNNER_|INPUT_|LC_)/.test(key)) continue;
    if (["LANG", "LANGUAGE", "SKILLS_MARKETPLACE_SYNC_LANG", "TZ", "PATH", "NODE_OPTIONS"].includes(key)) continue;
    clean[key] = value;
  }
  return { ...clean, LANG: "C.UTF-8", TZ: "UTC", PATH: NODE_ONLY_PATH, ...extra };
}

/** Run the CLI with a clean, host-independent environment (see cleanEnv). */
export function cli(args, { env = {}, cwd } = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    env: cleanEnv(env),
    cwd,
    timeout: 60_000,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

export const read = (...parts) => fs.readFileSync(path.join(...parts), "utf8");
