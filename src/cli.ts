#!/usr/bin/env node
import { parseArgs } from "node:util";
import { initConfig, run } from "./index.js";
import { resolveLang, t } from "./i18n.js";
import { annotations, formatJson, formatText, writeGithubOutput } from "./report.js";
import type { ClaudeValidate, Lang } from "./types.js";
import { UsageError } from "./types.js";

const COMMANDS = ["init", "sync", "check", "validate"] as const;

/** Find --lang before full parsing so even option errors are shown in the chosen language. */
function earlyLang(argv: string[]): Lang {
  const i = argv.findIndex((a) => a === "--lang" || a.startsWith("--lang="));
  let value: string | undefined;
  if (i >= 0) value = argv[i].includes("=") ? argv[i].split("=")[1] : argv[i + 1];
  return resolveLang(value);
}

/** Turn a Node parseArgs error into a message in the chosen language. */
function optionError(lang: Lang, code: string, detail: string): string {
  const quoted = /'([^']*)'/.exec(detail)?.[1] ?? "";
  if (code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
    return t(lang, "err.unknownOption", { option: quoted });
  }
  if (code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") {
    return t(lang, "err.missingValue", { option: quoted.split(" ")[0] });
  }
  if (code === "ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL") {
    return t(lang, "err.unexpectedArg", { arg: quoted });
  }
  return t(lang, "err.option", { detail });
}

function main(argv: string[]): number {
  const lang = earlyLang(argv);
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        cwd: { type: "string" },
        config: { type: "string" },
        format: { type: "string" },
        "claude-validate": { type: "string" },
        lang: { type: "string" },
        name: { type: "string" },
        owner: { type: "string" },
        mode: { type: "string" },
        targets: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });

    if (values.help) {
      console.log(t(lang, "help.text"));
      return 0;
    }
    const command = positionals[0];
    if (!command) throw new UsageError(t(lang, "err.noCommand"));
    if (!(COMMANDS as readonly string[]).includes(command)) {
      throw new UsageError(t(lang, "err.unknownCommand", { command }));
    }
    // `check ./repo` 처럼 경로를 위치 인자로 주면 조용히 무시되지 않도록 막는다.
    if (positionals.length > 1) {
      throw new UsageError(t(lang, "err.extraArgs", { args: positionals.slice(1).join(" ") }));
    }
    const choose = (option: string, value: string | undefined, allowed: string[]): void => {
      if (value !== undefined && !allowed.includes(value)) {
        throw new UsageError(t(lang, "err.badValue", { option, value, allowed: allowed.join(", ") }));
      }
    };
    choose("--lang", values.lang, ["en", "ko"]);
    choose("--format", values.format, ["text", "json"]);
    choose("--claude-validate", values["claude-validate"], ["auto", "true", "false"]);

    const options = {
      cwd: values.cwd,
      config: values.config,
      lang,
      claudeValidate: (values["claude-validate"] ?? "auto") as ClaudeValidate,
    };

    if (command === "init") {
      const { file } = initConfig({ ...options, name: values.name, owner: values.owner, mode: values.mode, targets: values.targets });
      console.log(t(lang, "init.created", { file }));
      console.log(t(lang, "init.next"));
      return 0;
    }

    const result = run(command as "sync" | "check" | "validate", options);
    writeGithubOutput(process.env.GITHUB_OUTPUT, result);
    if (values.format === "json") {
      console.log(formatJson(result));
    } else {
      const text = formatText(result);
      if (text) console.log(text);
      if (process.env.GITHUB_ACTIONS === "true") {
        for (const line of annotations(result)) console.log(line);
      }
    }
    return result.exitCode;
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(error.message);
      return 2;
    }
    // parseArgs errors (unknown option, missing value) are usage errors too
    const code = (error as { code?: string }).code;
    if (typeof code === "string" && code.startsWith("ERR_PARSE_ARGS")) {
      console.error(optionError(lang, code, (error as Error).message));
      return 2;
    }
    throw error;
  }
}

process.exitCode = main(process.argv.slice(2));
