// Real-agent check: generate the demo manifests, then let the actual CLIs read them.
//   claude: `claude plugin validate <repo> --strict`
//   codex : add the marketplace into an isolated CODEX_HOME, install the plugin,
//           and count the skills in `codex debug prompt-input`.
// Missing CLIs print SKIP for that line. Nothing is written to ~/.claude or ~/.codex.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli.js");
const demoSkills = ["commit-helper", "pdf-tools", "release-notes"];
const marketplace = "demo-skills";

const work = fs.mkdtempSync(path.join(os.tmpdir(), "sms-e2e-"));
const repo = path.join(work, "repo");
fs.cpSync(path.join(root, "examples", "demo-skills"), repo, { recursive: true });

function sh(cmd, args, { env = {}, timeout = 300_000 } = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", env: { ...process.env, ...env }, timeout });
  return { ok: !r.error && r.status === 0, missing: r.error?.code === "ENOENT", out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

let failed = false;
try {
  checkAgents();
} finally {
  // always remove the temp folder, even when a step throws
  fs.rmSync(work, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);

function checkAgents() {
const gen = sh(process.execPath, [cli, "sync", "--cwd", repo, "--claude-validate", "false", "--lang", "en"]);
if (!gen.ok) {
  console.log(gen.out);
  console.log("e2e: could not generate the demo manifests");
  failed = true;
  return;
}

// --- Claude Code -----------------------------------------------------------
const claudeProbe = sh("claude", ["--version"], { timeout: 30_000 });
if (claudeProbe.missing || !claudeProbe.ok) {
  console.log("claude: SKIP (claude not found in PATH)");
} else {
  const v = sh("claude", ["plugin", "validate", repo, "--strict"]);
  if (v.ok && /Validation passed/.test(v.out)) console.log(`claude: Validation passed (${claudeProbe.out.trim()})`);
  else {
    failed = true;
    console.log(`claude: FAIL\n${v.out}`);
  }
}

// --- Codex -----------------------------------------------------------------
const codexProbe = sh("codex", ["--version"], { timeout: 30_000 });
if (codexProbe.missing || !codexProbe.ok) {
  console.log("codex: SKIP (codex not found in PATH)");
} else {
  const home = path.join(work, "codex-home");
  fs.mkdirSync(home);
  const env = { CODEX_HOME: home };
  const add = sh("codex", ["plugin", "marketplace", "add", repo], { env });
  const install = add.ok ? sh("codex", ["plugin", "add", `${marketplace}@${marketplace}`], { env }) : add;
  const prompt = install.ok ? sh("codex", ["debug", "prompt-input"], { env }) : install;
  const loaded = prompt.ok ? demoSkills.filter((n) => prompt.out.includes(`${marketplace}:${n}`)) : [];
  if (loaded.length === demoSkills.length) console.log(`codex: ${loaded.length} skills loaded (${codexProbe.out.split("\n").find((l) => l.startsWith("codex-cli")) ?? "codex"})`);
  else {
    failed = true;
    console.log(`codex: FAIL (${loaded.length}/${demoSkills.length} skills loaded)\n${(prompt.ok ? "" : prompt.out).slice(0, 2000)}`);
  }
}
}
