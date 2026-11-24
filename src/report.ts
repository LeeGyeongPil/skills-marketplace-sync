import fs from "node:fs";
import { t } from "./i18n.js";
import type { Diagnostic, RunResult } from "./types.js";

/** GitHub workflow-command escaping (message part). */
function escapeData(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

/** GitHub workflow-command escaping (property part). */
function escapeProperty(value: string): string {
  return escapeData(value).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

/** One `::error file=…,line=…,title=CODE::message` line per diagnostic and per drifted file. */
export function annotations(result: RunResult): string[] {
  const lines: string[] = [];
  for (const d of result.diagnostics) {
    const level = d.level === "error" ? "error" : "warning";
    const props = [`file=${escapeProperty(d.file)}`];
    if (d.line !== undefined) props.push(`line=${d.line}`);
    props.push(`title=${escapeProperty(d.code)}`);
    lines.push(`::${level} ${props.join(",")}::${escapeData(d.message)}`);
  }
  for (const d of result.drift) {
    const message = `${t(result.lang, "out.drift", { path: d.path })}. ${t(result.lang, "out.driftHelp")}`;
    lines.push(`::error file=${escapeProperty(d.path)},title=SMS-DRIFT::${escapeData(message)}`);
  }
  return lines;
}

function diagnosticLine(d: Diagnostic): string {
  const where = d.line !== undefined ? `${d.file}:${d.line}` : d.file;
  return `${d.level === "error" ? "error  " : "warning"} ${d.code}  ${where}  ${d.message}`;
}

export function formatText(result: RunResult): string {
  const lines: string[] = [];
  for (const d of result.diagnostics) lines.push(diagnosticLine(d));
  lines.push(...result.notes);
  for (const d of result.drift) {
    lines.push("", d.diff);
  }
  if (result.drift.length > 0) lines.push("", t(result.lang, "out.driftHelp"));
  const errors = result.diagnostics.filter((d) => d.level === "error").length;
  const warnings = result.diagnostics.length - errors;
  if (result.diagnostics.length > 0) lines.push(t(result.lang, "out.summary", { errors, warnings }));
  return lines.join("\n");
}

export function formatJson(result: RunResult): string {
  return JSON.stringify(
    {
      command: result.command,
      exitCode: result.exitCode,
      skills: result.skills,
      written: result.written,
      drift: result.drift,
      diagnostics: result.diagnostics,
      notes: result.notes,
    },
    null,
    2,
  );
}

/** Append `drift=` and `errors=` to the file named by $GITHUB_OUTPUT (used by action.yml). */
export function writeGithubOutput(file: string | undefined, result: RunResult): void {
  if (!file) return;
  const errors = result.diagnostics.filter((d) => d.level === "error").length;
  fs.appendFileSync(file, `drift=${result.drift.length > 0}\nerrors=${errors}\n`);
}
