import assert from "node:assert/strict";
import test from "node:test";
import { FIXTURES, cli, copyFixture, read } from "./helpers.mjs";

// AC-3
test("reports Agent Skills and manifest rule violations with file and line", () => {
  const result = cli(["validate", "--cwd", `${FIXTURES}/invalid`, "--format", "json", "--claude-validate", "false", "--lang", "en"]);
  assert.equal(result.status, 1);
  const found = JSON.parse(result.stdout).diagnostics.map((d) => `${d.code} ${d.file}:${d.line ?? "-"}`);
  assert.deepEqual(found.sort(), [
    "SMS-E001 skills/bad-frontmatter/SKILL.md:1",
    "SMS-E002 skills/Bad--Name/SKILL.md:2",
    "SMS-E003 skills/mismatch-folder/SKILL.md:2",
    "SMS-E004 skills/no-desc/SKILL.md:2",
    "SMS-E005 skills/long-compat/SKILL.md:4",
    "SMS-E007 skills-marketplace.yml:1",
    "SMS-E008 .claude-plugin/marketplace.json:10",
    "SMS-E009 .claude-plugin/plugin.json:-",
  ].sort());
});

test("violating skills are left out of the manifest but sync still writes the file", () => {
  const dir = copyFixture("invalid");
  const result = cli(["sync", "--cwd", dir, "--claude-validate", "false", "--lang", "en"]);
  assert.equal(result.status, 1);
  const manifest = JSON.parse(read(dir, ".claude-plugin", "marketplace.json"));
  const bundle = manifest.plugins.find((p) => p.name === "agent-skills");
  assert.deepEqual(bundle.skills, ["./skills/ok-skill"]);
  // the hand-written entry is untouched
  assert.deepEqual(manifest.plugins.at(-1), { name: "ghost-plugin", source: "./skills/ghost" });
});

test("reserved-name variants are detected", async () => {
  const { marketplaceNameProblem } = await import("../dist/rules.js");
  for (const name of ["claude-plugins-official", "claudeai-tools", "claude.code.plugins", "helperé", "bad\u0007name"]) {
    assert.notEqual(marketplaceNameProblem(name), null, name);
  }
  for (const name of ["my-skills", "team.skills_v2"]) assert.equal(marketplaceNameProblem(name), null, name);
});
