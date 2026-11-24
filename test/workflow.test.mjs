// The project CI must stay minimal and offline (plan v2, AC-10).
import assert from "node:assert/strict";
import test from "node:test";
import { ROOT, read } from "./helpers.mjs";

const ci = read(ROOT, ".github", "workflows", "ci.yml");
const pkg = JSON.parse(read(ROOT, "package.json"));

test("ci workflow is a single offline job without dev dependencies", () => {
  const jobNames = ci.slice(ci.indexOf("\njobs:")).match(/^ {2}[\w-]+:\s*$/gm) ?? [];
  assert.equal(jobNames.length, 1, `expected one job, got ${jobNames.join(",")}`);
  assert.doesNotMatch(ci, /^\s*matrix:/m);
  assert.doesNotMatch(ci, /^\s*schedule:/m);
  assert.doesNotMatch(ci, /^\s*(cache|container|services):/m);
  assert.doesNotMatch(ci, /\bdocker\b/);
  const nodeVersions = [...ci.matchAll(/node-version:\s*"?([^"\n]+)"?/g)].map((m) => m[1]);
  assert.deepEqual(nodeVersions, ["26"]);
  const uses = [...ci.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1].replace(/@.*/, ""));
  assert.deepEqual(uses.sort(), ["./", "actions/checkout", "actions/setup-node"]);
  assert.match(ci, /npm ci --omit=dev/);
  assert.match(ci, /npm run test:ci/);
  assert.doesNotMatch(ci, /npm run build|tsc/);
  assert.match(pkg.scripts["test:ci"], /^node --test /);
  assert.doesNotMatch(pkg.scripts["test:ci"], /build/);
  assert.ok(pkg.scripts["verify:dist"].includes("git diff --exit-code dist/"));
});
