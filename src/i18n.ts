import { en } from "./locales/en.js";
import type { MessageKey } from "./locales/en.js";
import { ko } from "./locales/ko.js";
import type { Lang } from "./types.js";

export type { MessageKey };

export const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, ko };

/** Env var that selects the language for this tool. */
export const LANG_ENV = "SKILLS_MARKETPLACE_SYNC_LANG";

function fromLocale(value: string | undefined): Lang | undefined {
  if (!value) return undefined;
  return value.toLowerCase().startsWith("ko") ? "ko" : "en";
}

/**
 * Language order: --lang flag > SKILLS_MARKETPLACE_SYNC_LANG > LC_ALL > LC_MESSAGES > LANG.
 * The first variable that is set and non-empty decides; anything not Korean is English.
 */
export function resolveLang(flag: string | undefined, env: NodeJS.ProcessEnv = process.env): Lang {
  if (flag === "en" || flag === "ko") return flag;
  for (const key of [LANG_ENV, "LC_ALL", "LC_MESSAGES", "LANG"]) {
    const lang = fromLocale(env[key]);
    if (lang) return lang;
  }
  return "en";
}

/** Look up a message and substitute {placeholders}. */
export function t(lang: Lang, key: MessageKey, params: Record<string, string | number> = {}): string {
  const template = MESSAGES[lang][key];
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}
