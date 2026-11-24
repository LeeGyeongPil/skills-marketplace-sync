import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { cli, copyFixture, read } from "./helpers.mjs";

// AC-4
test("preserves human-added keys and unmanaged entries", () => {
  const dir = copyFixture("human-fields");
  const before = JSON.parse(read(dir, ".claude-plugin", "marketplace.json"));
  const result = cli(["sync", "--cwd", dir, "--claude-validate", "false", "--lang", "en"]);
  assert.equal(result.status, 0, result.stdout);
  const after = JSON.parse(read(dir, ".claude-plugin", "marketplace.json"));

  const bundle = after.plugins[0];
  assert.deepEqual(bundle.skills, ["./skills/keep-a", "./skills/keep-b"], "removed skill dropped");
  assert.equal(bundle.version, "1.2.3");
  assert.deepEqual(bundle.keywords, ["review", "git"]);
  assert.equal(bundle.homepage, "https://example.com/human-skills");
  assert.equal(after.$schema, before.$schema);
  assert.deepEqual(after.renames, before.renames);
  assert.deepEqual(after.plugins[1], before.plugins[1], "external entry untouched");
  assert.deepEqual(Object.keys(bundle), ["name", "source", "strict", "description", "version", "skills", "keywords", "homepage"]);

  const check = cli(["check", "--cwd", dir, "--claude-validate", "false", "--lang", "en"]);
  assert.equal(check.status, 0, check.stdout);
});

test("per-skill mode removes entries whose folder is gone and keeps others", () => {
  const dir = copyFixture("valid");
  cli(["sync", "--cwd", dir, "--config", "skills-marketplace.per-skill.yml", "--claude-validate", "false"]);
  fs.rmSync(`${dir}/skills/pdf-tools`, { recursive: true });
  const result = cli(["sync", "--cwd", dir, "--config", "skills-marketplace.per-skill.yml", "--claude-validate", "false", "--lang", "en"]);
  assert.match(result.stdout, /removed entry "pdf-tools"/);
  const names = JSON.parse(read(dir, ".claude-plugin", "marketplace.json")).plugins.map((p) => p.name);
  assert.deepEqual(names, ["commit-helper", "release-notes"]);
});
