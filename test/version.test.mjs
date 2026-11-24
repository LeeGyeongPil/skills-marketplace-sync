import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(root, f), "utf8");
const VERSION = "0.1.2";

test("version is consistent across package, lock, changelog and READMEs", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.version, VERSION);

  const lock = JSON.parse(read("package-lock.json"));
  assert.equal(lock.version, VERSION);
  assert.equal(lock.packages[""].version, VERSION);

  const changelog = read("CHANGELOG.md");
  const first = changelog.match(/^## \[([^\]]+)\]/m);
  assert.ok(first, "CHANGELOG has a release heading");
  assert.equal(first[1], VERSION);
  assert.ok(changelog.includes("## [0.1.0]"), "0.1.0 entry is kept");

  for (const f of ["README.md", "README.ko.md"]) {
    const text = read(f);
    assert.ok(text.includes(`@v${VERSION}`), `${f} references @v${VERSION}`);
    assert.ok(!text.includes("@v0.1.0"), `${f} has no stale @v0.1.0`);
  }
});
