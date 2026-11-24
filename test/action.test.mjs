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
