# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-11-24

### Fixed
- Unknown options, extra arguments, unwritable files and unreadable YAML now exit 2 with a clear message instead of a stack trace.
- CI: one offline job on Node 26 (production-only install, tests on committed `dist/`) and `.gitattributes` for stable `dist` diffs; `npm run verify:dist` checks `dist/` locally.
- `--claude-validate true` without the `claude` CLI now reports that it is required (exit 2) instead of a misleading "skipped" message.

## [0.1.0] - 2026-11-24

### Added
- `init`, `sync`, `check` and `validate` commands (npm CLI and composite GitHub Action).
- Generation of `.claude-plugin/marketplace.json` (bundle and per-skill modes) and `.agents/plugins/marketplace.json` (Codex).
- Rules SMS-E001..E010 and SMS-W001..W006 with file and line, including checks `claude plugin validate` does not make.
- Merge rules that keep hand-written keys and unmanaged entries; deterministic output.
- GitHub annotations (`::error file=,line=,title=`) and `drift` / `errors` step outputs.
- English and Korean messages (`--lang`, `SKILLS_MARKETPLACE_SYNC_LANG`, `LC_ALL` / `LC_MESSAGES` / `LANG`).
- `npm run e2e:agents` to verify the demo output with the real Claude Code and Codex CLIs.
