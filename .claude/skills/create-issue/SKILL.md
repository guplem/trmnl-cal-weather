---
name: create-issue
description: Create a well-structured GitHub issue with duplicate detection, code verification, and auto-labeling. Use whenever the user asks to create, file, open, log, or raise a GitHub issue, in any wording.
argument-hint: [brief description]
---

# Interactive Issue Creation

Create a GitHub issue with a standardized structure, duplicate detection, code verification, and auto-labeling.

## 1. Gather Initial Context

- If `$ARGUMENTS` contains a text description, use it as the initial context.
- If `$ARGUMENTS` is empty, ask using `AskUserQuestion`:
  > "Describe the issue you want to create. A sentence or two is enough -- I'll help structure it."
- Then ask using `AskUserQuestion` whether the user has links with additional context (error logs, screenshots, related discussions). If yes, fetch and read them.

## 2. Deep Understanding -- Clarify Until Crystal Clear

**This step is mandatory and must not be skipped.** Before moving forward, you must be fully confident that you understand exactly what the user wants.

1. **Summarize your understanding**: what the user is describing, why it matters (impact, who is affected), and where in the system it applies.
2. **Identify gaps and ambiguities**: could the description mean two things? Is the scope clear? For bugs, do you know the exact reproduction path or are you guessing? For features/improvements, is the desired behavior precise or vague?
3. **Ask clarifying questions, one at a time**, using `AskUserQuestion` with options when applicable. Iterate: if an answer raises new questions, ask those too. Never assume. Do not interrogate unnecessarily: if the description is genuinely clear, a brief confirmation is enough.

## 3. Determine Issue Type

Infer the type from the context: **Bug** (something broken), **Feature** (new capability), **Improvement** (enhancement to something existing), **Task** (refactors, chores, other specific work). Only ask via `AskUserQuestion` if truly ambiguous; otherwise infer silently and confirm in the combined review (Step 8). Store as `ISSUE_TYPE`.

## 4. Investigate the Codebase

Before structuring the issue:

1. **Identify affected areas** and search the codebase for the relevant code paths.
2. **For bugs, verify the bug actually exists in the current code.** If the code looks correct, report: "I checked the code and this appears to already be handled in `<file>:<line>`. Are you sure you want to create this issue?" Stop if the user agrees it is not a bug.
3. **For features/improvements**, identify the existing code that would change and the patterns already in place. Run the **pattern-scout** agent if a new pattern is being introduced.
4. **Check relevant ADRs**: run the **adr-checker** agent in consult mode.

Store findings as `CODE_CONTEXT`. This context feeds the issue's Context section and the label detection; it is **not** a proposed solution (see Step 7).

## 5. Search for Duplicates and Related Issues

Do **not** fetch "the newest N issues": `gh issue list --limit N` returns only the most recently created, so an older duplicate is never seen. Search by **relevance across the whole repo**, both states. Scope every `gh search issues` to this repo with `--repo guplem/trmnl-cal-weather` (without it, `gh search` queries all of GitHub).

1. **Derive 2-4 keyword sets** from the issue intent (Step 3) and `CODE_CONTEXT`, each a few words, varied so together they cover how a duplicate might be worded: the feature or component name; the symptom or user-facing effect; the specific entity or code path. Each set must include the exact noun a person would put in the **title** -- the title is the strongest duplicate signal.
2. **Search each set, relevance-ranked** (put the keywords BEFORE any qualifier, or `gh search` returns an empty list):
   ```bash
   gh search issues --repo guplem/trmnl-cal-weather "<keywords> in:title" --limit 20 --json number,title,state,stateReason,url   # title-scoped: strongest signal
   gh search issues --repo guplem/trmnl-cal-weather "<keywords>" --limit 30 --json number,title,state,stateReason,url            # title + body: differently worded duplicates
   ```
3. **Recency backup, once**: `gh issue list --state all --limit 40 --json number,title,state,stateReason,labels`. It catches duplicates that use none of your keywords and brand-new issues the search index has not picked up yet (`gh search` is eventually consistent).
4. **Compare intent, not wording.** `stateReason` separates `COMPLETED` from `NOT_PLANNED`; treat any `NOT_PLANNED` match as a **reopen candidate**, not a reason to create a duplicate (backlog issues are often closed as not-planned to reopen later).
5. **If a likely duplicate exists**, ask via `AskUserQuestion`: stop (duplicate) / link it (related but different) / create anyway. **Prefer reopening a matching not-planned issue over creating a duplicate.**
6. Store related issue numbers as `RELATED_ISSUES`.

## 6. Auto-Detect Labels

1. **Area labels** (select all that apply, based on the affected code paths):

   No area labels defined yet; propose none, and rebuild this table when labels exist.

2. **Never assign priority labels.** Priority is a human decision made when triaging, not something the agent infers.
3. Store the proposed labels as `PROPOSED_LABELS` and present them with the draft in Step 8. Do not ask about labels separately.

## 7. Draft the Issue

Compose the issue body based on `ISSUE_TYPE`, then apply the TL;DR rule, the Proposed Solution rule, the root-cause language rules, the anti-redundancy rules, and the communication style below. Task issues follow the closest matching template (usually Improvement).

### TL;DR rule (mandatory, all templates)

Every issue body must start with a **TL;DR** line before any section header:

```markdown
**TL;DR:** <one sentence summarizing what this issue achieves or fixes>
```

The TL;DR is one sentence (two only if genuinely necessary) that tells a reader what the issue is about without reading anything else. The title alone is rarely enough. It describes the **outcome**, not the process. A TL;DR names what this issue makes true (the "after") plus what it replaces (the "before"). For brand-new capabilities, the "before" is empty: state the new capability and why it matters.

Examples:
- Good (change): "Currently the form silently wraps malformed JSON in input fields; this issue makes the form validate those fields before submission."
- Good (new capability): "Add a panel that surfaces per-week ingredient waste, so menus can be tuned without exporting data."
- Bad (after only): "Validate JSON in input fields before submission." The reader cannot tell what is broken today.
- Bad (before only): "Consent changes reach service A but not service B." States the gap but not what this issue makes true.

### Proposed Solution rule (mandatory)

**Never include a "Proposed Solution" section unless the user proposed a solution during issue creation.** A solution counts as user-proposed when it came from the user directly, or from source material the user brought (a linked discussion, a decision they quoted). Your own code investigation (Step 4) is **not** a user-proposed solution.

- If the user proposed a solution, include the section and write it from what they said. You may add file/function references from `CODE_CONTEXT` to make their idea concrete, but the approach must be theirs.
- If the user did **not** propose a solution, **omit the section entirely.** The investigation still feeds Context and verifies bugs; it does not produce a solution the user never asked for.

### Root-cause language rules

The issue documents a problem whose fix has not been tested, so the draft must never state a root cause as certain fact.

1. Never write "The root cause is X." Express confidence instead: "most likely caused by X" (high), "might be caused by X" (medium), "the root cause is unclear, but it may be related to X" (low).
2. Prefer omitting speculated root causes from the body; a clear Context already conveys the problem and its impact.
3. When you do include a hypothesis, keep it brief and clearly hedged. One sentence is usually enough.
4. Never use "Root cause" as a section header. Fold any causal hypothesis into Context.

### Bug template

```markdown
**TL;DR:** <one sentence with the after and the before. "Currently X; this issue makes Y." or "Y instead of X.">

## Context

<What is broken, who is affected, and why it matters. Combine the problem description and current behavior into one cohesive narrative. Hedge any causal hypothesis.>

## Steps to Reproduce

1. <Step 1>
2. <Observe...>

## Expected Behavior

<What should happen instead. Only include if the correct behavior is not obvious from Context.>

## Proposed Solution

<ONLY if the user proposed one; otherwise omit this entire section.>

## Acceptance Criteria

- [ ] <Observable behavior that defines "done" -- NOT an implementation detail>
- [ ] <Edge case or regression guard, if applicable>

## Related Issues & PRs

<Links. Omit this section entirely if there are none.>
```

### Feature template

```markdown
**TL;DR:** <one sentence: what new capability this adds and why it matters>

## Context

<Why this feature is needed AND what it should do at a high level.>

## Proposed Solution

<ONLY if the user proposed one; otherwise omit this entire section.>

## Acceptance Criteria

- [ ] <Observable behavior that defines "done">

## Related Issues & PRs

<Links. Omit this section entirely if there are none.>
```

### Improvement template

Identical to the Bug template but without "Steps to Reproduce".

### Anti-redundancy rules (mandatory)

Before finalizing the draft, re-read it and apply:

1. **No section should restate another section.** Merge overlapping content into whichever section carries more weight.
2. **Context must not restate the title.** The title is always visible; Context adds what the title does not contain (the why, affected users, impact).
3. **Acceptance Criteria must describe observable behaviors, not implementation details.** AC answers "what does the system do?", not "what code do I write?". Good: "the list shows a warning when the file is malformed". Bad: "add `validateFile` to `FileService`".
4. **No generic AC items.** "Lint passes", "no regressions", "tests pass" are CI responsibilities, not issue-specific criteria.
5. **Omit empty or boilerplate sections.**
6. **Steps to Reproduce must add value.** If reproduction is trivially "open the page and look", omit Steps and describe the condition in Context.
7. **A kept Proposed Solution must add implementation detail** (specific files, functions, patterns, ADRs), never a restatement of Expected Behavior.
8. **The redundancy self-check.** After writing, read each section and ask: "If I deleted this, would the reader lose any information?" If no, delete it.

### Communication style (critical for triage)

The issue is read to be **chosen, not studied**: whoever triages skims it among many, with little context and little time, so if it is not instantly clear it gets skipped or misjudged. Write it in the repo's **Communicating with users** style (`AGENTS.md`) -- lead with the point (the TL;DR), assume a short attention span, one idea per sentence, define jargon, keep it skimmable.

### Title options

Generate 2-3 title candidates, each under 80 characters, concise and specific, describing the outcome, and **without** a conventional prefix (`fix:`, `feat:`). Vary the focus: user-facing impact, technical component, action-oriented (optional third). Present them via `AskUserQuestion`; the user picks one or types a custom title. Store as `SELECTED_TITLE`.

## 8. Draft Review with User

Present the full draft: issue type, selected title, labels, related issues, and the complete body. Ask via `AskUserQuestion`: "Looks good, create it" / "Make changes first". Apply requested changes and re-present.

## 9. Create the Issue

Always include the `waiting-for-human-check` label. If it doesn't exist, create it first:

```bash
gh label create "waiting-for-human-check" --description "No human has verified this yet -- direct AI output" --color "D93F0B" 2>/dev/null || true
```

```bash
gh issue create \
  --title "$SELECTED_TITLE" \
  --label "waiting-for-human-check" \
  --body "$(cat <<'EOF'
<full issue body>
EOF
)"
```

When area labels apply, extend the `--label` value comma-separated (for example `--label "middleware,waiting-for-human-check"`); with none, keep it exactly as above. Never emit a leading or trailing comma.

**Leave the issue unassigned** (a human triages and assigns; only PRs are self-assigned). Report back: the URL, title, type, labels, and any linked issues.

## Important Rules

- **Never create without confirmation.** Always show the draft and get approval first.
- **Clarify before structuring.** Step 2 is mandatory.
- **A big goal is a milestone, not a parent issue.** A milestone groups issues that each ship on their own; a dependency between issues is a note in the body, never a reason to nest them. Reserve parent issues for the rare atomic-deploy bundle where sub-issues must ship together or production breaks.
- **Code verification is mandatory for bugs.** Check the bug exists before creating.
- **Duplicate check is mandatory**, including issues closed as not planned.
- **Auto-infer, then confirm.** Propose type and labels; let the user adjust in one combined review.
- **Keep acceptance criteria testable and observable.** Each criterion is something `implement-issue` can verify.
- **No redundancy.** Every sentence must earn its place.
