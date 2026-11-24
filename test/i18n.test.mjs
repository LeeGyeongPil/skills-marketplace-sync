import assert from "node:assert/strict";
import test from "node:test";
import { FIXTURES, cli } from "./helpers.mjs";

// AC-8
test("language resolution order and identical message keys", async () => {
  const { resolveLang, MESSAGES } = await import("../dist/i18n.js");

  assert.deepEqual(Object.keys(MESSAGES.en).sort(), Object.keys(MESSAGES.ko).sort());
  for (const lang of ["en", "ko"]) {
    for (const [key, value] of Object.entries(MESSAGES[lang])) {
      assert.ok(value.length > 0, `${lang}.${key} is empty`);
      // placeholders must match between languages
      const holders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
      assert.equal(holders(MESSAGES[lang][key]), holders(MESSAGES.en[key]), `placeholders differ for ${key}`);
    }
  }

  // flag > tool env > LC_ALL > LC_MESSAGES > LANG > English
  assert.equal(resolveLang("en", { SKILLS_MARKETPLACE_SYNC_LANG: "ko", LANG: "ko_KR.UTF-8" }), "en");
  assert.equal(resolveLang(undefined, { SKILLS_MARKETPLACE_SYNC_LANG: "ko", LC_ALL: "en_US.UTF-8" }), "ko");
  assert.equal(resolveLang(undefined, { LC_ALL: "ko_KR.UTF-8", LANG: "en_US.UTF-8" }), "ko");
  assert.equal(resolveLang(undefined, { LC_MESSAGES: "en_US.UTF-8", LANG: "ko_KR.UTF-8" }), "en");
  assert.equal(resolveLang(undefined, { LANG: "ko_KR.UTF-8" }), "ko");
  assert.equal(resolveLang(undefined, { LANG: "fr_FR.UTF-8" }), "en");
  assert.equal(resolveLang(undefined, {}), "en");

  // the CLI really switches
  const args = ["validate", "--cwd", `${FIXTURES}/invalid`, "--claude-validate", "false"];
  const en = cli([...args, "--lang", "en"]);
  const ko = cli([...args, "--lang", "ko"]);
  assert.match(en.stdout, /is invalid\. Use 1-64 chars/);
  assert.match(ko.stdout, /규칙에 맞지 않습니다/);
  assert.match(cli(["--help", "--lang", "ko"]).stdout, /사용법/);
  assert.match(cli(["--help", "--lang", "en"]).stdout, /Usage:/);
  assert.match(cli(args, { env: { SKILLS_MARKETPLACE_SYNC_LANG: "ko" } }).stdout, /오류 \d+건/);
  assert.match(cli(args, { env: { LANG: "ko_KR.UTF-8" } }).stdout, /오류 \d+건/);
  assert.match(cli(args, { env: { LANG: "ko_KR.UTF-8" } }).stdout, /오류 \d+건/);
  assert.match(cli([...args, "--lang", "en"], { env: { LANG: "ko_KR.UTF-8" } }).stdout, /\d+ error\(s\)/);
});
