import type { MessageKey } from "./locales/en.js";
import type { Lang } from "./types.js";
export type { MessageKey };
export declare const MESSAGES: Record<Lang, Record<MessageKey, string>>;
/** Env var that selects the language for this tool. */
export declare const LANG_ENV = "SKILLS_MARKETPLACE_SYNC_LANG";
/**
 * Language order: --lang flag > SKILLS_MARKETPLACE_SYNC_LANG > LC_ALL > LC_MESSAGES > LANG.
 * The first variable that is set and non-empty decides; anything not Korean is English.
 */
export declare function resolveLang(flag: string | undefined, env?: NodeJS.ProcessEnv): Lang;
/** Look up a message and substitute {placeholders}. */
export declare function t(lang: Lang, key: MessageKey, params?: Record<string, string | number>): string;
