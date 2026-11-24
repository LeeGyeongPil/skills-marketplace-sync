// Offline safety: without claude/codex on PATH nothing fails (plan v2, AC-7).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { ROOT, cli } from "./helpers.mjs";

// A PATH that holds no agent CLIs; node itself is started by absolute path.
const emptyPath = path.join(ROOT, "test", "fixtures", "no-such-bin");

test("e2e script and auto validate skip missing agent CLIs", () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", "e2e-agents.mjs")], {
    encoding: "utf8",
    env: { ...process.env, PATH: emptyPath },
    timeout: 60_000,
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^claude: SKIP/m);
  assert.match(r.stdout, /^codex: SKIP/m);

  const c = cli(["check", "--cwd", path.join(ROOT, "examples", "demo-skills"), "--lang", "en"], {
    env: { PATH: emptyPath },
  });
  assert.equal(c.status, 0, c.stdout + c.stderr);
  assert.match(c.stdout, /OK {2}\.claude-plugin\/marketplace\.json is up to date \(3 skills\)/);
});
