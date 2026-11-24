import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { cli, copyFixture, read } from "./helpers.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "sms-cli-"));

test("usage errors exit 2 with a fix", () => {
  const empty = tmp();
  const noConfig = cli(["check", "--cwd", empty, "--lang", "en"]);
  assert.equal(noConfig.status, 2);
  assert.match(noConfig.stderr, /Run `skills-marketplace-sync init/);
  assert.equal(cli([], { env: {} }).status, 2);
  assert.equal(cli(["frobnicate"]).status, 2);
  assert.equal(cli(["check", "--bogus"]).status, 2);
  assert.equal(cli(["check", "--format", "xml"]).status, 2);
  assert.equal(cli(["check", "--cwd", path.join(empty, "missing")]).status, 2);

  fs.writeFileSync(path.join(empty, "skills-marketplace.yml"), "name: [unclosed\n");
  assert.equal(cli(["check", "--cwd", empty, "--lang", "en"]).status, 2);
  fs.writeFileSync(path.join(empty, "skills-marketplace.yml"), "name: x\n");
  const noOwner = cli(["check", "--cwd", empty, "--lang", "en"]);
  assert.equal(noOwner.status, 2);
  assert.match(noOwner.stderr, /owner\.name is required/);
});

test("init writes a config that sync accepts", () => {
  const dir = tmp();
  const init = cli(["init", "--cwd", dir, "--name", "my-skills", "--owner", "Jane Doe", "--lang", "en"]);
  assert.equal(init.status, 0, init.stderr);
  fs.mkdirSync(path.join(dir, "skills", "hello"), { recursive: true });
  fs.writeFileSync(path.join(dir, "skills", "hello", "SKILL.md"), "---\nname: hello\ndescription: Says hello. Use when greeting.\n---\n");
  const sync = cli(["sync", "--cwd", dir, "--claude-validate", "false", "--lang", "en"]);
  assert.equal(sync.status, 0, sync.stdout);
  assert.match(read(dir, ".claude-plugin", "marketplace.json"), /"\.\/skills\/hello"/);
  // refuses to overwrite, needs owner, rejects reserved names
  assert.equal(cli(["init", "--cwd", dir, "--name", "x", "--owner", "y"]).status, 2);
  assert.equal(cli(["init", "--cwd", tmp(), "--name", "x"]).status, 2);
  const reserved = cli(["init", "--cwd", tmp(), "--name", "agent-skills", "--owner", "y", "--lang", "en"]);
  assert.equal(reserved.status, 2);
  assert.match(reserved.stderr, /SMS-E007|reserved/);
});

test("broken existing manifest is a usage error, not a crash", () => {
  const dir = tmp();
  cli(["init", "--cwd", dir, "--name", "my-skills", "--owner", "Jane"]);
  fs.mkdirSync(path.join(dir, ".claude-plugin"));
  fs.writeFileSync(path.join(dir, ".claude-plugin", "marketplace.json"), "{ not json");
  const result = cli(["sync", "--cwd", dir, "--claude-validate", "false", "--lang", "en"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /delete the file/i);
});

test("unifiedDiff handles add, remove and identical input", async () => {
  const { unifiedDiff } = await import("../dist/diff.js");
  assert.equal(unifiedDiff("a\nb\n", "a\nb\n", "x", "y"), "--- x\n+++ y");
  const diff = unifiedDiff("a\nb\nc\n", "a\nc\nd\n", "x", "y");
  assert.match(diff, /^-b$/m);
  assert.match(diff, /^\+d$/m);
});

test("claude validate true without claude on PATH is a usage error", () => {
  const dir = tmp();
  cli(["init", "--cwd", dir, "--name", "my-skills", "--owner", "Jane"]);
  cli(["sync", "--cwd", dir, "--claude-validate", "false"]);
  const result = cli(["check", "--cwd", dir, "--claude-validate", "true", "--lang", "en"], { env: { PATH: "/nonexistent" } });
  assert.equal(result.status, 2);
});

test("option errors are localized and exit 2", () => {
  const unknownKo = cli(["check", "--wat", "--lang", "ko"]);
  assert.equal(unknownKo.status, 2);
  assert.match(unknownKo.stderr, /알 수 없는 옵션 "--wat"/);
  const unknownEn = cli(["check", "--wat", "--lang", "en"]);
  assert.equal(unknownEn.status, 2);
  assert.match(unknownEn.stderr, /Unknown option "--wat"\. See --help/);
  const missingKo = cli(["check", "--lang", "ko", "--cwd"]);
  assert.equal(missingKo.status, 2);
  assert.match(missingKo.stderr, /--cwd 옵션에 값이 필요합니다/);
  const missingEn = cli(["check", "--lang", "en", "--cwd"]);
  assert.match(missingEn.stderr, /Option --cwd needs a value/);
});

test("a symlinked skill folder is followed", () => {
  const dir = copyFixture("valid");
  const real = path.join(dir, "elsewhere", "linked-skill");
  fs.mkdirSync(real, { recursive: true });
  fs.writeFileSync(path.join(real, "SKILL.md"), "---\nname: linked-skill\ndescription: A linked skill. Use when testing symlinks.\n---\n# Linked\n");
  fs.symlinkSync(real, path.join(dir, "skills", "linked-skill"), "dir");
  const result = cli(["check", "--cwd", dir, "--claude-validate", "false", "--lang", "en"]);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /linked-skill/);
});

test("CRLF line endings in a manifest are not drift", () => {
  const dir = copyFixture("valid");
  assert.equal(cli(["sync", "--cwd", dir, "--claude-validate", "false"]).status, 0);
  const file = path.join(dir, ".claude-plugin", "marketplace.json");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/\n/g, "\r\n"));
  const result = cli(["check", "--cwd", dir, "--claude-validate", "false", "--lang", "en"]);
  assert.equal(result.status, 0, result.stdout);
});

test("extra positional arguments are a usage error", () => {
  const en = cli(["check", "extra", "--cwd", "examples/demo-skills", "--claude-validate", "false", "--lang", "en"]);
  assert.equal(en.status, 2);
  assert.match(en.stderr, /Too many arguments: "extra"\. .*--cwd/);
  const ko = cli(["check", "extra", "--lang", "ko"]);
  assert.equal(ko.status, 2);
  assert.match(ko.stderr, /인자가 너무 많습니다/);
});

test("a write failure is a localized usage error, not a stack trace", (t) => {
  // root ignores folder permissions (some containers), so the check only means something for normal users
  if (process.platform === "win32" || process.getuid?.() === 0) {
    t.skip("folder permissions are not enforced for this user");
    return;
  }
  const dir = tmp();
  fs.chmodSync(dir, 0o555);
  try {
    const en = cli(["init", "--cwd", dir, "--name", "x", "--owner", "y", "--lang", "en"]);
    assert.equal(en.status, 2, en.stderr);
    assert.match(en.stderr, /Cannot write .*skills-marketplace\.yml \(EACCES\)/);
    assert.doesNotMatch(en.stderr, /node:fs|at Object\./);
    const ko = cli(["init", "--cwd", dir, "--name", "x", "--owner", "y", "--lang", "ko"]);
    assert.equal(ko.status, 2);
    assert.match(ko.stderr, /쓸 수 없습니다/);
  } finally {
    fs.chmodSync(dir, 0o755);
  }
});
