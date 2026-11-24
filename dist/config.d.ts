import { Config, Lang } from "./types.js";
export declare const DEFAULT_CONFIG_FILE = "skills-marketplace.yml";
/** Read and validate the config file. Throws UsageError (exit code 2) on any problem. */
export declare function loadConfig(root: string, configFile?: string, lang?: Lang): Config;
/** Convert a folder glob (`*` and `?` only) to a RegExp. */
export declare function globToRegExp(glob: string): RegExp;
