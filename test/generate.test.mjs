import assert from "node:assert/strict";
import test from "node:test";
import { FIXTURES, cli, copyFixture, read } from "./helpers.mjs";

const NO_CLAUDE = ["--claude-validate", "false", "--lang", "en"];

// AC-1
test("sync output matches golden and is idempotent", () => {
  for (const [config, golden] of [
    ["skills-marketplace.yml", "bundle.claude.json"],
    ["skills-marketplace.per-skill.yml", "per-skill.claude.json"],
  ]) {
    const dir = copyFixture("valid");
    const first = cli(["sync", "--cwd", dir, "--config", config, ...NO_CLAUDE]);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    const manifest = read(dir, ".claude-plugin", "marketplace.json");
    assert.equal(manifest, read(FIXTURES, "golden", golden), `${config} differs from golden`);

    const second = cli(["sync", "--cwd", dir, "--config", config, ...NO_CLAUDE]);
    assert.equal(second.status, 0);
    assert.match(second.stdout, /unchanged \.claude-plugin\/marketplace\.json/);
    assert.equal(read(dir, ".claude-plugin", "marketplace.json"), manifest);

    const check = cli(["check", "--cwd", dir, "--config", config, ...NO_CLAUDE]);
    assert.equal(check.status, 0, check.stdout);
    assert.match(check.stdout, /OK {2}\.claude-plugin\/marketplace\.json is up to date \(3 skills\)/);
  }
});

// AC-2 (the fixture is only read)
test("check fails on drift with a diff and a sync hint", () => {
  const result = cli(["check", "--cwd", `${FIXTURES}/drift`, ...NO_CLAUDE]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^\+ {8}"\.\/skills\/new-skill",$/m);
  assert.match(result.stdout, /skills-marketplace-sync sync/);
  assert.match(result.stdout, /DRIFT {2}\.claude-plugin\/marketplace\.json is out of date/);
});

test("check reports a missing manifest as drift", () => {
  const dir = copyFixture("valid");
  const result = cli(["check", "--cwd", dir, ...NO_CLAUDE]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^\+ {2}"name": "example-skills",$/m);
});

test("json format is machine readable", () => {
  const result = cli(["check", "--cwd", `${FIXTURES}/drift`, "--format", "json", ...NO_CLAUDE]);
  const data = JSON.parse(result.stdout);
  assert.equal(data.exitCode, 1);
  assert.equal(data.drift[0].path, ".claude-plugin/marketplace.json");
  assert.deepEqual(data.skills, ["alpha", "new-skill", "zeta"]);
});
