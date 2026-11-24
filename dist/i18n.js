import { en } from "./locales/en.js";
import { ko } from "./locales/ko.js";
export const MESSAGES = { en, ko };
/** Env var that selects the language for this tool. */
export const LANG_ENV = "SKILLS_MARKETPLACE_SYNC_LANG";
function fromLocale(value) {
    if (!value)
        return undefined;
    return value.toLowerCase().startsWith("ko") ? "ko" : "en";
}
/**
 * Language order: --lang flag > SKILLS_MARKETPLACE_SYNC_LANG > LC_ALL > LC_MESSAGES > LANG.
 * The first variable that is set and non-empty decides; anything not Korean is English.
 */
export function resolveLang(flag, env = process.env) {
    if (flag === "en" || flag === "ko")
        return flag;
    for (const key of [LANG_ENV, "LC_ALL", "LC_MESSAGES", "LANG"]) {
        const lang = fromLocale(env[key]);
        if (lang)
            return lang;
    }
    return "en";
}
/** Look up a message and substitute {placeholders}. */
export function t(lang, key, params = {}) {
    const template = MESSAGES[lang][key];
    return template.replace(/\{(\w+)\}/g, (whole, name) => name in params ? String(params[name]) : whole);
}
