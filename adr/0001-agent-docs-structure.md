# AGENTS.md map with Claude-Code-only skills, subagents, and ADRs

## Context

Before this, the repo carried a single standalone `CLAUDE.md` at the root with all agent guidance (What This Is, Architecture, Key Files, Patterns, Gotchas) inline, and no skills, subagents, ADRs, or CI. This repo adopts a shared personal standard: a root `AGENTS.md` as the always-loaded map, on-demand skills, subagents for delegated checks, and living ADRs. The repo is developed with Claude Code only, so no multi-tool sync machinery is needed.

## Decision

- `AGENTS.md` at the repo root is the canonical, always-loaded map. `CLAUDE.md` is a one-line `@AGENTS.md` shim so Claude Code loads it. Tools that read `AGENTS.md` natively work without extra files.
- Areas that earn their own doc follow the same pattern: `<area>/AGENTS.md` holds the content, next to a one-line `<area>/CLAUDE.md` shim that makes Claude Code load it on demand. This repo has two: `src/` (the template) and `src/middleware/` (the Apps Script proxy). A nested `AGENTS.md` without its shim never loads.
- Skills live committed directly at `.claude/skills/<name>/SKILL.md`. No `.agents/skills/` canonical tree, no gitignored mirror, no sync scripts.
- All skills are model-invocable (no `disable-model-invocation` frontmatter). The set is small, so the startup-context cost of their descriptions is low.
- Subagents live at `.claude/agents/<name>.md` (`pattern-scout`, `adr-checker`, `validate`).
- ADRs live in this single `adr/` directory, indexed as one-line rows in the root `AGENTS.md`, and are living documents updated in place. The folder's conventions live in `adr/AGENTS.md`, auto-loaded via its `adr/CLAUDE.md` shim.
- `.claude/settings.json` holds the permission allow/deny lists and PostToolUse hooks.

**Rejected alternative:** a standalone `CLAUDE.md` with all guidance inline (the previous state). Only Claude Code reads it, and always-loaded procedures cost attention on every session; skills load procedures on demand and area docs load area rules on demand.

## Consequences

**Positive:**

- One canonical copy of each instruction; the always-on context stays small because procedures load on demand as skills and area rules load only in their area.
- No sync scripts or mirrors to maintain.

**Trade-offs and follow-up:**

- Skills, subagents, and settings are Claude-Code-only surfaces. If another agent tool is adopted, move skills to a canonical `.agents/skills/` tree with a gitignored `.claude/skills/` mirror and a sync script.
- If the number of skills grows enough that their always-loaded descriptions bloat startup context, add `disable-model-invocation: true` to the human-invoked ones and introduce an `/invoke` chaining skill.
