---
name: write-ai-instructions
description: Author or edit AI-facing instruction files in this repo - AGENTS.md, skills under .claude/skills/, subagents under .claude/agents/, and spawned-agent prompts. Covers the prompt-writing rules for current Claude models, the map-not-manual standard for AGENTS.md, the living-document rule, and when and where to persist a new rule. Use when editing any AI-instruction file.
---

# Writing prompts for agents, skills, and rules

These rules apply when you author or edit any AI-facing content in this repo: `AGENTS.md`, skills under `.claude/skills/`, subagents under `.claude/agents/`, and prompts for agents you spawn. They match how current Claude models read instructions: more literally, with fewer default tool calls and subagents, and with response length scaled to the task.

- **Be explicit, not inferential.** State what must happen for every case. Do not expect the model to generalize "do X for case A" to "also do X for case B": list both, or write "applies to all `<category>`". Instructions the reader must interpret get interpreted narrowly.
- **Name the tool or action.** The model prefers reasoning over using tools. If a step needs an exhaustive search, say "search exhaustively" or "find several examples". If a step needs parallel subagents, say "launch them in parallel in a single message". If a step needs a specific file, name it by path.
- **Say when to delegate.** Subagents are spawned less often by default. Decide up front whether you want delegation and say so.
- **Do not scaffold progress updates.** Remove patterns like "after every N tool calls, summarize progress": the harness already produces interim updates. A structured end-of-step report is fine; running chat-style commentary is not. When you do want a report, spell out the exact format and give a concrete example block.
- **Specify output shape only when it matters.** Add length, structure, or verbosity guidance only when the output has a specific consumer: a status block, a checklist, a structured report. Do not ask for "thorough" or "detailed" output without naming who reads it.
- **Prefer positive examples over negative ones.** "Do X" works better than "don't do Y". Keep negative rules for real anti-patterns where the failure is not obvious from the positive instruction alone.
- **Write the rule, not the reminder.** A prompt is read fresh each time; it cannot nudge the model mid-task. Put everything needed for correctness up front, not buried in closing tips.
- **Avoid round-number counts unless the count itself matters.** "Brainstorm 5-7 causes" is read as a hard range. Use "a handful", "several", or a range scaled to the task when breadth is the goal but the exact number is not.
- **Trust effort, not scaffolding, for depth.** Do not write "think step by step" or "reason carefully" as a generic kick. Ask for depth only when the task truly needs it, and pair it with concrete structure.
- **Write in plain English.** Short sentences, one idea each. Gloss any jargon, acronym, or tool name on first use in a short parenthetical. These files are read by humans and by agents, and the humans may read English as a second language.

## Instruction files are living

Every AI-facing file here is meant to be updated: `AGENTS.md` and area docs, skills, subagents, ADRs, and the code comments in the repo. When you learn something during a task that would help future agents, update the right file in the same session. When a file holds wrong or outdated information, fix it or remove it; do not leave it to mislead the next reader. Keeping these files true is part of the work, not a separate chore.

## Do not restate the user's global rules

Some rules live in the user's global configuration (`~/.claude/CLAUDE.md`) and already apply to every project: for example, when the agent may commit, or the plain-English writing style. Do not copy those into a project file. Repeating a global rule bloats the always-loaded context and drifts out of sync with the source. Reference it if you must; do not duplicate it.

## Writing and restructuring AGENTS.md (the map-not-manual standard)

`AGENTS.md` loads into context on every session, so every line costs attention the agent could spend on the task. The agent already knows how to code; a long file makes it follow each single rule less reliably. So `AGENTS.md` holds only what the agent cannot infer and needs at every code touch: product and architecture facts, conventions that differ from the obvious default, and load-bearing gotchas. Everything else moves to a skill or is cut.

### Sort every line into keep, move, or cut

- **Keep inline** (stays always-on in `AGENTS.md`): non-negotiables, the architecture map, conventions an agent would otherwise get wrong, and each load-bearing gotcha (a rule that prevents a recurring bug). Write each as one direct rule. A short code snippet or a one-line why can stay inline; on its own it does not justify a skill.
- **Move to a skill** (loads only when relevant): a procedure or way of working, meaning a "how to do X" the agent calls when doing X. Code examples and explanations move with it only when they serve that procedure. Link the skill from `AGENTS.md` with an imperative "Whenever you <do X>, use the `<skill>` skill".
- **Cut**: anything already written elsewhere (an ADR, `README.md`, another instruction file, or the global config), anything a competent agent already knows, and ADR-index rows written as summaries. The ADR index is a one-line pointer per ADR, never a summary.

### The safety rule: never drop performance-relevant knowledge

A gotcha may move into a skill only if a one-line warning stays inline in `AGENTS.md`. The agent keeps the warning at all times; the skill adds the code and the reasoning when it is doing that work. Before you finish, re-read the original file and account for every section: confirm each removed block is kept inline, moved to a skill, or already lives in the ADR or README that `AGENTS.md` now points to. If a rule lived only in `AGENTS.md` and has no other home, do not delete it.

### Style

- State the gotcha directly. Do not explain why a rule is in the document.
- Reference a skill with the same imperative form every time: "Whenever you <do X>, use the `<skill-name>` skill."
- Bold only the few words that carry the rule.

### Mechanics (this repo)

- Skills live committed at `.claude/skills/<name>/SKILL.md`; subagents at `.claude/agents/<name>.md`. There are no sync scripts or mirrors; `adr/0001-agent-docs-structure.md` records why. Area docs follow the root pattern: content in `<area>/AGENTS.md` (this repo has `src/AGENTS.md` and `src/middleware/AGENTS.md`), loaded through its one-line `<area>/CLAUDE.md` shim. Edit the AGENTS.md, never the shim.
- Keep every skill model-invocable (no `disable-model-invocation` frontmatter) while the skill set stays small, and write each description to name exactly when the skill applies.
- Every `CLAUDE.md` (root or area) is a one-line `@AGENTS.md` shim; never put content in it.

## When and where to persist a new rule

When you discover something during a task that was **extremely hard to find, deeply non-obvious, and would save real time in future sessions**, persist it. This also applies when the user says **"every time"**, **"always"**, or **"never"**: persist it right away, not just for the current session.

- A rule that guides **AI behavior or coding decisions** -> `AGENTS.md` (or the area doc, if it is area-specific).
- A **procedure** ("how to do X") -> a skill.
- A **new** architectural pattern or cross-cutting standard -> a new ADR; a **change** to an existing pattern -> update that ADR in place. The **adr-checker** agent writes both.
- A **repeatable shell action triggered by a tool event** -> a Claude Code hook in `.claude/settings.json`.

**Also add** a rule whenever the codebase does something in a way that differs from what an AI would naturally write. If the correct approach here is not the obvious one, a future agent will get it wrong without an explicit rule.

**Do NOT add:** standard patterns found through normal code reading, things already covered by an existing rule or easy to find by search, one-off context unlikely to recur, or anything already in the user's global config. The bar is high: if a future agent could work it out within a few minutes of exploration, leave it out.
