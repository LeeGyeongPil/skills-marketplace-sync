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

/** Run the CLI with a clean language environment. */
export function cli(args, { env = {}, cwd } = {}) {
  const clean = { ...process.env };
  for (const key of ["LANG", "LC_ALL", "LC_MESSAGES", "SKILLS_MARKETPLACE_SYNC_LANG", "GITHUB_ACTIONS", "GITHUB_OUTPUT"]) {
    delete clean[key];
  }
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    env: { ...clean, ...env },
    cwd,
    timeout: 60_000,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

export const read = (...parts) => fs.readFileSync(path.join(...parts), "utf8");
