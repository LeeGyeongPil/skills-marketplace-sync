import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { cli, copyFixture, read } from "./helpers.mjs";

const NO_CLAUDE = ["--claude-validate", "false", "--lang", "en", "--format", "json"];

// AC-5
test("codex manifest shape, per-skill fallback and name rule", () => {
  // shape + per-skill falls back to one bundle entry for Codex
  const dir = copyFixture("codex");
  const result = cli(["sync", "--cwd", dir, ...NO_CLAUDE]);
  assert.equal(result.status, 0, result.stdout);
  const codex = JSON.parse(read(dir, ".agents", "plugins", "marketplace.json"));
  assert.deepEqual(codex, {
    name: "codex-skills",
    interface: { displayName: "Codex skills" },
    plugins: [
      {
        name: "codex-skills",
        source: { source: "local", path: "./" },
        policy: { installation: "AVAILABLE", authentication: "ON_FIRST_USE" },
        category: "Productivity",
      },
    ],
  });
  // Claude side is still per-skill
  const claude = JSON.parse(read(dir, ".claude-plugin", "marketplace.json"));
  assert.deepEqual(claude.plugins.map((p) => p.source), ["./skills/one", "./skills/two"]);

  // Codex name rule and policy values
  const bad = cli(["validate", "--cwd", copyFixture("codex"), "--config", "skills-marketplace.badname.yml", ...NO_CLAUDE]);
  assert.equal(bad.status, 1);
  const codes = JSON.parse(bad.stdout).diagnostics.filter((d) => d.code === "SMS-E010");
  assert.equal(codes.length, 2);
  assert.match(codes[0].message, /My_Plugin/);
  assert.match(codes[1].message, /SOMETIMES/);

  // per-skill without the codex target warns
  const warn = cli(["validate", "--cwd", copyFixture("codex"), "--config", "skills-marketplace.claude-only.yml", ...NO_CLAUDE]);
  assert.equal(warn.status, 0);
  assert.ok(JSON.parse(warn.stdout).diagnostics.some((d) => d.code === "SMS-W001" && d.level === "warning"));
});

test("codex target with a custom skillsDir is a configuration error", () => {
  const dir = copyFixture("codex");
  fs.appendFileSync(`${dir}/skills-marketplace.yml`, "skillsDir: agent-skills\n");
  const result = cli(["sync", "--cwd", dir, "--lang", "en"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /skillsDir: skills/);
});
