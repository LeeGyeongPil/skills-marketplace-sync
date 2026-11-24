import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parse } from "yaml";
import { FIXTURES, ROOT, cli, read } from "./helpers.mjs";

// AC-6
test("emits workflow annotations and outputs; action.yml declares inputs", () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sms-out-")), "github_output");
  const result = cli(["validate", "--cwd", `${FIXTURES}/invalid`, "--claude-validate", "false", "--lang", "en"], {
    env: { GITHUB_ACTIONS: "true", GITHUB_OUTPUT: out },
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^::error file=skills\/Bad--Name\/SKILL\.md,line=2,title=SMS-E002::/m);
  assert.match(result.stdout, /^::error file=\.claude-plugin\/plugin\.json,title=SMS-E009::/m);
  assert.equal(read(out), "drift=false\nerrors=8\n");

  // drift annotation and output
  const driftOut = path.join(path.dirname(out), "drift_output");
  const drift = cli(["check", "--cwd", `${FIXTURES}/drift`, "--claude-validate", "false", "--lang", "en"], {
    env: { GITHUB_ACTIONS: "true", GITHUB_OUTPUT: driftOut },
  });
  assert.match(drift.stdout, /^::error file=\.claude-plugin\/marketplace\.json,title=SMS-DRIFT::/m);
  assert.equal(read(driftOut), "drift=true\nerrors=0\n");

  // action.yml
  const action = parse(read(ROOT, "action.yml"));
  assert.equal(action.runs.using, "composite");
  assert.deepEqual(Object.keys(action.inputs).sort(), ["claude-validate", "command", "config", "lang", "working-directory"]);
  assert.deepEqual(Object.keys(action.outputs).sort(), ["drift", "errors"]);
  assert.equal(action.inputs.command.default, "check");
});

test("annotation text escapes newlines, percent signs and commas", async () => {
  const { annotations } = await import("../dist/report.js");
  const lines = annotations({
    lang: "en",
    drift: [],
    diagnostics: [{ code: "SMS-E001", level: "error", file: "a,b:c.md", line: 3, message: "50%\nnext" }],
  });
  assert.equal(lines[0], "::error file=a%2Cb%3Ac.md,line=3,title=SMS-E001::50%25%0Anext");
});

// The suite itself runs inside GitHub Actions: runner variables, the runner's locale and
// whatever agent CLIs the host has must not leak into the CLI processes the tests start.
test("tests are independent of runner variables, locale and host PATH", () => {
  const saved = { ...process.env };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sms-runner-"));
  const out = path.join(tmpDir, "github_output");
  fs.writeFileSync(out, "");
  // a fake `claude` that would fail validation if it were ever called
  const fakeBin = path.join(tmpDir, "bin");
  fs.mkdirSync(fakeBin);
  fs.writeFileSync(path.join(fakeBin, "claude"), "#!/bin/sh\necho fake-claude-called\nexit 1\n", { mode: 0o755 });
  Object.assign(process.env, {
    CI: "true",
    GITHUB_ACTIONS: "true",
    GITHUB_OUTPUT: out,
    GITHUB_STEP_SUMMARY: out,
    RUNNER_OS: "Linux",
    LANG: "ko_KR.UTF-8",
    LC_ALL: "ko_KR.UTF-8",
    TZ: "Asia/Seoul",
    PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
  });
  try {
    const r = cli(["check", "--cwd", path.join(ROOT, "examples", "demo-skills")]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /^OK {2}\.claude-plugin\/marketplace\.json is up to date \(3 skills\)/m);
    assert.doesNotMatch(r.stdout + r.stderr, /^::|fake-claude-called/m);
    assert.equal(read(out), "", "GITHUB_OUTPUT of the host step is untouched");
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
