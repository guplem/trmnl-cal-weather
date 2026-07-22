# TRMNL Calendar + Weather Plugin

Custom TRMNL e-ink display plugin combining Google Calendar (weekly time-grid view) with Open-Meteo weather forecast and air quality. Single Liquid template with embedded CSS + JS, fed by a Google Apps Script middleware. Setup, run, and deploy details live in the human `README.md` and `MIDDLEWARE_SETUP.md`.

Delegate to these agents at the right moment (each agent's own description says what it does). They fall into two groups, by when they run.

**Before you implement (explore agents, launched as preparation):**

- **pattern-scout**: before implementing any non-trivial helper, template section, or middleware endpoint, and any time you ask "how do we do X here?". Returns real code examples with the rules distilled from them.
- **adr-checker** (consult mode): before implementing in an ADR-relevant area (the "Architecture Decision Records (ADRs)" section lists them). Returns the decisions the work must follow.

**After you implement, before you ship:**

- **docs-checker**: after a change that could affect documented content. Checks every documentation location (code comments, `README.md`, `MIDDLEWARE_SETUP.md`, `TROUBLESHOOTING.md`, `AGENTS.md` files, ADRs) against the code and fixes drift.
- **validate**: just before creating a PR or pushing. Runs the repo's checks the way CI does (`bun test .`) and reports pass or fail.
- **adr-checker** (maintain mode): after you introduce a new architectural pattern or change one an ADR records. Creates or updates the ADR.

Beyond these, spawn subagents freely: hand off research, code exploration, and parallel analysis so the files they read stay out of your own context. Give each subagent one task.

## Communicating with users

The people who read your output may read English as a second language and may be new to the area. Write **every** message a person reads this way: chat replies, PR and issue text, review comments, and commit messages.

- **Short sentences, one idea each.** Use common words. Avoid idioms, slang, and cultural references.
- **Lead with the answer**, then only the detail that changes what the reader does. Cut filler and hedging. Do not use em dashes.
- **Assume a short attention span.** The reader usually skims to make a quick decision (which PR to review, which issue to pick), with little context and little time; put the single most important thing first, and make each part land even if they stop after the first line.
- **Gloss each jargon term, acronym, or tool/library name on first use** in one short clause, or pick a simpler word.
- **Explain a concept briefly before going deeper.** Do not assume a flow, tool, or pattern is already known.
- **Assume junior-level knowledge of the area.** Name the things you reference (files, commands, terms) instead of assuming the reader can guess.

## Commands

| Task | Command | Notes |
|---|---|---|
| Build generated files | `bun run build` | Inlines `src/lib` helpers into the committed `src/full.liquid` and the `.gs` (from their `*.template` shells). Run after editing `src/lib` or a template. |
| Run all tests | `bun test .` | Bun's test runner; discovers every `*.test.js`. What CI runs. Includes the generated-file drift test. No install needed. |
| Run one area's tests | `bun test src/lib` | The pure helpers (single source). |
| Local visual preview | `trmnlp serve` | Ruby gem `trmnl_preview`; serves a local render with `.trmnlp.yml` sample data. Human-run; see README. |

There is no formatter or linter (deliberate; see ADR 0005). Whenever you need to confirm the code still passes, delegate to the **validate** agent (it runs `bun test .` the way CI does).

## Architecture

- **Data strategy:** Private Plugin with Polling (3 URLs), all pointing to one Google Apps Script middleware (`?src=cal|weather|aqi`)
  - `IDX_0` = `src=cal` - Google Calendar events read directly by the script, served from a trigger-warmed cache (building live is ~15s and can exceed TRMNL's 30s timeout); mimics the TRMNL calendar `/data` shape (flat array with `date_time`, `start_full`, `end_full`, `calname`)
  - `IDX_1` = `src=weather` - Open-Meteo forecast passthrough (daily + hourly + current), served from a trigger-warmed cache
  - `IDX_2` = `src=aqi` - Open-Meteo air quality passthrough (optional, European AQI)
- **Legacy direct mode:** the TRMNL calendar `/data` URL + direct Open-Meteo URLs still parse identically; the middleware replaced them for reliability (see Gotchas).
- **Rendering:** JS builds the DOM from Liquid-injected JSON. No external dependencies.
- **Screen:** 800x480px, 2-bit grayscale (4 native shades: #000, #555, #AAA, #fff)

## Key Files

- `src/full.liquid` - **Generated** production template to paste into TRMNL (do not edit). Built from `src/full.liquid.template` + `src/lib` by `bun run build`.
- `src/full.liquid.template` - Hand-edited shell for `full.liquid`; one `@generated:helpers` marker where the build inlines the `src/lib` helpers.
- `src/lib/` - The only hand-edited copy of the pure helpers, each with a `bun test` suite; the single source inlined into `full.liquid` and the `.gs` by the build (see ADR 0006 and `src/AGENTS.md`).
- `build.mjs` - The build step (`bun run build`); inlines `src/lib` into both generated files.
- `src/settings.yml` - Plugin settings + polling URLs for trmnlp local dev
- `src/form_fields.yml` - Plugin form fields shown when installing the recipe
- `src/middleware/calendar_weather_proxy.gs` - **Generated** Apps Script middleware to paste at script.google.com (do not edit; built from `...gs.template` + `src/lib/middleware.js`). Setup in `MIDDLEWARE_SETUP.md`; area doc in `src/middleware/AGENTS.md`.
- `.trmnlp.yml` - Local dev config with sample data

## Patterns

- Calendar events come as a flat array from the TRMNL API (not grouped by date)
- Event times prefer `start_full`/`end_full` ISO timestamps; the AM/PM `start`/`end` fields are used as fallback when `start_full`/`end_full` are absent
- `calname` contains email addresses, `calendar_names` map resolves them to display names
- Multi-day all-day events are duplicated onto each day they span
- Weather dates (ISO) used as the column source; calendar events matched by date
- Template supports both production (IDX_0 at top level) and trmnlp (custom_fields with Ruby hash format)

## Gotchas

- TRMNL pauses a native plugin's data sync while it is hidden in playlists (despite the tooltip claiming "Data sync is active"). This is why the middleware exists.
- TRMNL's polling timeout is 30s, fixed, and one slow URL degrades the whole plugin (all URLs treated as a unit).

Area-specific gotchas live in `src/AGENTS.md` (the template) and `src/middleware/AGENTS.md` (the Apps Script proxy).

## Test-Driven Development (mandatory)

Develop new behavior **test-first, red-green**: write a failing test that pins the behavior you want (**red**), make it pass with the smallest change (**green**), then clean up with the test as your safety net. A bug fix starts with a test that reproduces the bug.

- **Testable:** the pure logic in `src/lib/` (time parsing, overlap layout, ignored-event matching, the triple-encoded JSON recovery, `cleanText` truncation, cache key and forecast URL building). Tests are `src/lib/*.test.js`, run with `bun test .`.
- **Exempt:** the Liquid render, the DOM-building glue in `full.liquid.template`, and the Google-service calls in the `.gs` (CalendarApp, CacheService, UrlFetchApp). Their safety net is the local `trmnlp serve` visual run plus the on-screen diagnostic overlay.
- **Critical:** `src/lib/` is the single source of the pure helpers; `bun run build` inlines them into the generated `full.liquid` and `.gs`. Never edit those generated files. Change `src/lib` (or a `*.template`), run `bun run build`, and the drift test enforces the rest. See ADR 0006.

The gate: CI runs `bun test .` on every PR, and the repo ruleset "Requirements for merge" blocks merging until the `checks` check is green.

## Git Workflow

- Branch from `master`, PR back to `master`. Merging does **not** deploy: deploy is a manual paste into the TRMNL editor and Apps Script (see README). Whenever you create a branch, use the `create-branch` skill.
- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`. Whenever you commit, use the `write-commit` skill.
- **Manual-review flow:** a human reviews and merges. CI runs `bun test .` on every PR; the ruleset "Requirements for merge" blocks merging until the `checks` check is green. Never merge a red PR.
- The default branch stays `master` on purpose: `src/form_fields.yml` and the published TRMNL recipe contain hardcoded `.../blob/master/...` URLs. Renaming the branch would break them.

## Documentation Organization

Each kind of knowledge has one home. Write a change in the home that matches it; never duplicate the same content across homes. What decides the home is **when the file loads** and **how deep it goes**, not its subject.

| Home | Loaded | Holds |
|------|--------|-------|
| `AGENTS.md` | Every session | The map: architecture facts, conventions, gotchas, and the ADR index. Points to the homes below; does not repeat their depth. (`CLAUDE.md` is a one-line `@AGENTS.md` shim.) |
| `src/AGENTS.md` | On demand, when working in the template | The template's rendering conventions and gotchas, and the `src/lib` single-source + build rule. (Its `CLAUDE.md` is a one-line shim.) |
| `src/middleware/AGENTS.md` | On demand, when working in the middleware | The Apps Script proxy's conventions and gotchas. (Its `CLAUDE.md` is a one-line shim.) |
| `.claude/skills/<name>/SKILL.md` | On demand, when the task matches | One procedure: how to do X. |
| `adr/NNNN-*.md` | On demand, via adr-checker | One architectural decision and its why. |
| `README.md` | Read by humans | What the project is, setup, run, deploy, troubleshooting. |

**All of these files are living: keep them true.** When you learn something that helps future agents, update the right file in the same session. When a file holds wrong or outdated information, fix it or remove it. This covers code comments too. After implementation, the **docs-checker** agent catches drift you missed.

**Rules:**

- ADRs are agent-only: never reference or list them in a `README.md`.
- Number ADRs in sequence (`NNNN-kebab-title.md`) and never renumber an existing file. Index each one as a one-line row in the ADR table below, never a summary.
- Do not duplicate content between the human docs (`README.md`, `MIDDLEWARE_SETUP.md`, `TROUBLESHOOTING.md`) and `AGENTS.md`; reference it instead.
- `CLAUDE.md` is a one-line `@AGENTS.md` shim; edit `AGENTS.md` instead.

## Architecture Decision Records (ADRs)

ADRs live in `adr/`. Each records one architectural decision or cross-cutting standard and why. **One ADR per pattern, kept alive:** when a pattern changes, update its ADR in place; create a new ADR only for a genuinely new pattern. Most changes need no ADR. Conventions: `adr/AGENTS.md` (auto-loads through its `adr/CLAUDE.md` shim when you work in `adr/`).

**Before implementing** in an area that may carry a decision, delegate to the **adr-checker** agent in consult mode. These areas usually carry decisions: the middleware data layer and its cache, the template rendering and the full-view-only layout, the 2-bit grayscale palette constraint, the data contract between middleware and template, and the testing strategy.

**After implementing**, delegate to the **adr-checker** agent in maintain mode only if you introduced a new architectural pattern or changed one an ADR already records.

| ADR | Topic |
|-----|-------|
| [0001](adr/0001-agent-docs-structure.md) | `AGENTS.md` map + Claude-Code-only skills/subagents/settings |
| [0002](adr/0002-apps-script-middleware-data-layer.md) | Cache-warmed Google Apps Script middleware as the single data layer, to beat the playlist pause and the 30s poll timeout |
| [0003](adr/0003-full-view-only-layout.md) | Full-view-only layout; the other view templates are stubs |
| [0004](adr/0004-two-bit-grayscale-palette.md) | Design to the 4-shade 2-bit grayscale palette; no dithered colors |
| [0005](adr/0005-no-code-formatter.md) | No code formatter or linter; conventions and tests instead |
| [0006](adr/0006-extracted-testable-helpers-with-inline-copies.md) | Pure helpers live only in `src/lib` (single tested source); a build step inlines them into the generated `full.liquid` and `.gs`, and a drift test enforces it |

## GitHub issues, PRs, and other artifacts

- **Always self-assign PRs** when you create them.
- **Always link PRs to issues** with `Closes #N` in the PR body, so the issue auto-closes on merge.
- **Always add the `waiting-for-human-check` label** when you create a GitHub issue, PR, or any other reviewable artifact. It means no human has verified the content yet; a human removes it after reviewing. The label marks state (unreviewed), not origin.

If the repo has no `waiting-for-human-check` label, create it first:
```bash
gh label create "waiting-for-human-check" --description "No human has verified this yet -- direct AI output" --color "D93F0B"
```

Whenever you create a GitHub issue, use the `create-issue` skill. Whenever you implement one, use the `implement-issue` skill. Whenever you review a PR, use the `review-pr` skill.

## Coding standards

- **Match existing patterns.** Before writing code, find similar implementations and follow their style, structure, and conventions (the **pattern-scout** agent does this).
- **Explicit types** where the stack expresses them: JSDoc `@param`/`@returns` on the `src/lib` helpers (they carry the type annotations the plain JS cannot).
- **Comment the _why_, never the _what_.** A comment must carry what the code cannot: a non-obvious constraint, an intentional divergence, a trap a future reader would reintroduce. Do not document self-explanatory names or signatures, and match the comment density of the surrounding file.

## Refactoring safety

Whenever you rename or refactor a symbol, use the `rename-symbol` skill.

## Debugging

Whenever a fix attempt fails or a bug needs root-causing, use the `debug` skill.

## Writing prompts for agents and rules

Whenever you author or edit an AI-facing file (`AGENTS.md`, skills under `.claude/skills/`, subagents under `.claude/agents/`, prompts for agents you spawn), use the `write-ai-instructions` skill.

## Self-updating rules

These instruction files are living, and keeping them current is part of the work. Persist a rule right away (in the narrowest scope that fits) instead of applying it only this session when you discover something **extremely hard to find, deeply non-obvious, and time-saving for future sessions**, hit a pattern that **diverges from what an AI would write by default**, when the user says **"every time" / "always" / "never"**, or when **feedback on your own work reveals a standard you should have followed** (a PR review comment, a user correction). Persist it in these shared, committed files, never in personal memory or the global config, so the whole team gets the lesson. For where to write it, use the `write-ai-instructions` skill.
