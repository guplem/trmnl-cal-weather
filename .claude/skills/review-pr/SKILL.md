---
name: review-pr
description: Review a GitHub pull request and post one clear review, with inline comments. The default is collaborative - you analyze deeply, explain the changes in simple terms, ask the user about each finding, and post a review that reflects their decisions. Use when the user asks to review a PR. --no-verdict = programmatic COMMENT-only mode that also writes .reviews/<PR_NUMBER>-review.md (used by implement-issue). --autonomous = unattended review that posts a formal verdict.
argument-hint: "[pr-number] [--no-verdict | --autonomous]"
model: opus
---

_The review belongs to the user: you analyze, they decide. A finding you cannot back with a quoted line of code is not a finding._

# Review a pull request

Review a pull request (PR) and post one review to GitHub with inline comments. The default mode is collaborative: you analyze deeply, explain the changes so the user understands them, ask the user about every finding, and post a review that reflects their choices. The PR must already exist.

## Modes

Work out the mode from `$ARGUMENTS` before anything else:

1. Strip the flags from `$ARGUMENTS`; what remains is the PR number or URL.
2. If `--no-verdict` is present, set `MODE=no-verdict`. This wins even when `--autonomous` is also present.
3. Otherwise, if `--autonomous` is present, set `MODE=autonomous`. This posts a formal verdict with no human oversight: use it only when the user explicitly asked for an unattended review.
4. Otherwise set `MODE=interactive`.

| | `interactive` (default) | `no-verdict` | `autonomous` |
|---|---|---|---|
| Invoked by | A user running `/review-pr` | Other skills, e.g. `implement-issue` running `review-pr <PR> --no-verdict` | A user who explicitly asked for an unattended verdict |
| AskUserQuestion | Yes | **Never** | **Never** |
| GitHub review event | User decides: `APPROVE` / `REQUEST_CHANGES` / `COMMENT` | Always `COMMENT` | Derived from the findings |
| Writes `.reviews/<PR_NUMBER>-review.md` | No | Yes | No |
| Follow-up issues | Created with the user's approval via the `create-issue` skill | Never; listed as candidates in the local file | Never; listed as candidates in the summary |
| Verdict decided by | The user | A binary verdict in the local file only | The findings (any `[Required]` -> `REQUEST_CHANGES`) |

**Hard rule: in `no-verdict` and `autonomous` mode, never call `AskUserQuestion` for any reason.** These modes run unattended.

## 1. Setup (all modes)

Resolve the PR number:

- If the stripped `$ARGUMENTS` has a PR number or URL, use it as `PR_NUMBER`.
- Otherwise, in `interactive` mode, ask with `AskUserQuestion`: "Which PR do you want to review?" with options: the current branch's PR (`gh pr view --json number -q .number`; if none, say so and stop) or a specific number the user types.
- In `no-verdict` or `autonomous` mode, a missing PR number is a hard stop: report the error and stop. Do not ask.

Define these once; every later command uses them:

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
PR_AUTHOR=$(gh pr view $PR_NUMBER --json author -q .author.login)
CURRENT_USER=$(gh api user -q .login)
```

Set `IS_AUTHOR=true` when `PR_AUTHOR` equals `CURRENT_USER`. GitHub rejects `APPROVE` and `REQUEST_CHANGES` on your own PR (HTTP 422), so when `IS_AUTHOR` is true the verdict can only be `COMMENT`.

## 2. Gather context (all modes)

Fetch all of this in parallel:

```bash
gh pr view $PR_NUMBER --json title,body,author,labels,headRefName,baseRefName,url,additions,deletions,files,commits
gh pr diff $PR_NUMBER
gh pr diff $PR_NUMBER --name-only
gh pr checks $PR_NUMBER
```

Find linked issue numbers in the PR body (`Closes #123`, `Fixes #45`, bare `#67`). For each, read it **with its comments**, because the comments often hold the agreed approach:

```bash
gh issue view <number> --json title,body,labels,state,comments
```

Record: which areas the PR touches (`src/` template, `src/lib/` extracted helpers, `src/middleware/` Apps Script proxy), the total scope (additions/deletions, file count), the stated intent (commits + PR description), and any implementation proposal from the issue discussion.

## 3. Parallel deep analysis (all modes)

Spawn these as subagents. **Launch them all in one message, one block of parallel Agent calls, never one at a time.** Wait for all of them before phase 4. Give each analysis agent the PR number and tell it: you cannot spawn further subagents; do all searching yourself; output only the report described, with each finding carrying `File`, `Line(s)`, `Finding`, `Why it matters`, and `Suggestion`.

Always spawn these four analysis agents:

1. **Pattern & architecture.** Does new code sit and register where similar code does? Find two or three existing examples of each new kind of thing and compare. Read files beyond the diff to see how the codebase does it elsewhere.
2. **Completeness & issue alignment.** Does the PR deliver what the linked issue asks? Does it match any approach agreed in the issue comments? Flag missing deliverables and unexpected scope.
3. **Quality, safety & security.** Explicit types (JSDoc on `src/lib` helpers); error handling (no silently swallowed errors); security (secrets in the repo, e.g. a real `CONFIG.token`; unsanitized input); config documented; no dead code, no over-engineering, no unnecessary duplication. Confirm the ADR 0006 sync rule: if a pure helper changed inline in `full.liquid`/`.gs`, the matching `src/lib` copy and its test changed too, and vice versa.
4. **Testing & gaps.** Is red-green TDD respected (do the new `bun test` cases assert real behavior, not just run the code)? What edge cases are untested? Name 2-3 realistic untested inputs and what would happen for each. Any cross-codebase impact.

Also spawn, as siblings (they cannot run inside the analysis agents):

- **validate** (always): run `bun test .` and report pass or fail, with failing output verbatim.
- **pattern-scout** (only when the diff adds a new helper, template section, or middleware endpoint): find how similar ones are built here and report the convention with real examples.
- **adr-checker** in consult mode (only when the diff touches an ADR-relevant area): find the ADRs that constrain this area and summarize what they require.

## 4. Synthesize and triage (all modes)

1. **Collect** every finding, plus the validate results and `gh pr checks`. Use the pattern-scout and adr-checker reports as evidence.
2. **Verify mechanically.** For every finding, open the cited file at the cited lines with Read and copy the exact offending line(s) into the finding. If the code does not show what the finding claims, delete the finding. No quote, no finding.
3. **Deduplicate.** Merge findings that share one root cause into one; keep the highest severity.
4. **Classify severity.**
   - `[Required]`: blocks merge. Bugs that produce wrong output, security holes (a committed real token), missing deliverables from the issue, broken tests, an inline copy that drifted from its `src/lib` twin.
   - `[Suggestion]`: non-blocking improvement. Pattern divergence, missing edge-case test, naming, doc gaps, performance concerns.
   - `[Nitpick]`: trivial. Style, minor formatting, optional naming.

   Separate a real bug from a style preference or a future consideration; mark future considerations as such, with no action required now. Leave out product or UX decisions that are not code-level concerns.
5. **Triage by origin and scope.** A finding is **pre-existing** when the flagged lines are not `+` lines in `gh pr diff $PR_NUMBER`; otherwise it is **introduced by this PR**.

   | Origin | Scope | Disposition |
   |--------|-------|-------------|
   | This PR | Small | Fix in this PR, at its severity |
   | This PR | Too big | Split: the smallest corrective part stays; the rest becomes a follow-up issue |
   | Pre-existing | Any | Follow-up issue, even if small. Never `[Required]`, never blocks this PR |

   Placement: a concrete file-anchored defect becomes an inline comment; cross-cutting judgment (missing deliverables, architecture concerns spanning files) goes in the review body.

**Derive the verdict** per mode:

- `interactive`: the user decides in phase 6. Continue to phase 5.
- `autonomous`: any `[Required]` -> `REQUEST_CHANGES`; only `[Suggestion]`/`[Nitpick]` on a solid PR -> `APPROVE`; many suggestions that fit a comment better -> `COMMENT`. Skip to phase 7.
- `no-verdict`: two verdicts. **Local file verdict** (binary, for the review file): any `[Required]` -> `CHANGES_REQUESTED`, otherwise `APPROVED` (callers like `implement-issue` need a clear iterate-or-proceed signal). **GitHub review event**: always `COMMENT`. Skip to phase 7.

## 5. Explain the changes (interactive mode only)

Present the changes as if to a graduate engineer with little experience. The user must understand the solution before they can judge it.

- **Big picture** (2-3 sentences): what the PR does, why, and the state before it.
- **How it works** (mechanism): trace the flow end to end. Do not just list files; explain what calls what and in what order, using real code from the PR. Scale the depth to the PR: a 20-line fix needs a paragraph; a big feature needs a full walkthrough.
- **Changes grouped by purpose**, not by path: "to add X, these files...", "to wire it up, these...".
- **What is done well**: good decisions, clean patterns. The posted review body leads with this too.
- **Operational results**: what passed and failed from validate and `gh pr checks`. Split failures into infra/config problems, real logic failures (these are findings), and external problems (missing secrets, third-party outages).
- **Findings index**: a numbered list of every finding that survived phase 4, so the user sees the total before the questions begin. Example:
  ```
  1. [Required]   Inline copy in full.liquid drifted from src/lib - src/full.liquid:534 - fix in this PR
  2. [Suggestion] Missing test for empty input - src/lib/eventLayout.test.js - fix in this PR
  3. [Suggestion] Pre-existing: duplicated parse guard - follow-up issue
  ```

## 6. Gather the user's decisions (interactive mode only)

Walk the findings index with `AskUserQuestion`:

- **Pacing first**: when there are more than 6 non-nitpick findings, open with one question (header "Pacing", options: `Review each finding one by one` (Recommended) / `Accept all proposed classifications` / `Only ask about [Required] findings`) and honor the answer.
- **One question per `[Required]`/`[Suggestion]` finding**, in severity order. Each question carries enough context to decide without reading code: what the code does, why it matters, the alternatives, your recommendation. Options are relative to your proposed classification (for `[Required]`: `Post as Required (Recommended)` / `Downgrade to Suggestion` / `Don't mention` / `Follow-up issue instead`; for `[Suggestion]`: `Post as Suggestion (Recommended)` / `Upgrade to Required` / ...). Never write an "Other" option; the tool adds one.
- **Nitpicks in batches**: one `multiSelect: true` question per group of up to 4 nitpicks; the options are the nitpicks themselves.
- **Follow-up issues**: when the user picks "Follow-up issue instead" (or triage marked an item pre-existing/too-big and the user confirms), create it immediately with the `create-issue` skill; reference the PR in the issue and the issue in the review.
- **Discussion**: when the user asks "how does X work?", trace the real code path before answering. When the user corrects a finding, re-check it against the code and adjust; if you were wrong, say so plainly.
- **Open questions before the verdict**: after the last finding, ask whether the user has more questions. Answer each from the actual code. Only then move to the verdict.

**Verdict**: if any finding ended `[Required]`, the verdict is `REQUEST_CHANGES`; confirm it in prose, do not make the user pick from a list. Otherwise ask: `Approve with comments` / `Comment only`. If `IS_AUTHOR` is true, only `Comment only` is possible; say so.

## 7. Post the review (all modes)

Build one review payload and post it in one API call. In `autonomous` mode, print one line first: "Posting autonomous verdict <EVENT> without human review, as requested via --autonomous."

**Event type**: `interactive` = what the user chose; `no-verdict` = always `COMMENT`; `autonomous` = from phase 4 (forced to `COMMENT` if `IS_AUTHOR`).

**Inline comment format**: every inline comment starts with:
```
**`[Type]` One-line title describing the issue**
```
`[Type]` is `[Required]`, `[Suggestion]`, or `[Nitpick]`. Then the problem (referencing the specific code), why it matters, how the codebase does it elsewhere (with file references) when relevant, and a concrete fix (a code snippet when possible). Reference a follow-up issue when one exists.

**Body rules**: lead with what is done well, then the key findings grouped by theme, in 3-6 sentences. A finding that cannot be anchored to a diff line goes in the body with its `[Type]` tag, never silently dropped. In interactive mode this is the user's review: professional, no robot prefixes.

**Post it** (one call, not separate `gh pr comment` calls):
```bash
gh api repos/$REPO/pulls/$PR_NUMBER/reviews -X POST --input /tmp/review-payload.json
rm -f /tmp/review-payload.json
```
The payload is `{ "event": "...", "body": "...", "comments": [ { "path", "line", "side": "RIGHT", "body" } ] }`. `line` must be a line that appears in the diff; use `"side": "LEFT"` for a deleted line. **422 fallback**: if GitHub rejects the payload because a comment's line is not in the diff, move that finding into the body (with its tag and `file:line`) and post again.

## 8. Write the local findings file (--no-verdict mode only)

Also write `.reviews/<PR_NUMBER>-review.md` (create the folder first: `mkdir -p .reviews`):

```markdown
# Review: PR #<PR_NUMBER> - <PR title>

## Verdict: APPROVED | CHANGES_REQUESTED

## Summary
<1-3 sentence assessment>

## Required Changes
<!-- Empty if APPROVED -->
### 1. <title>
- **File:** `<path>` | **Line(s):** <range>
- **Description:** <what and why>
- **Suggestion:** <how to fix>

## Suggestions
### 1. <title>
...

## Nitpicks
### 1. <title>
...

## Follow-up Candidates
<!-- Pre-existing or too-big items triaged out of this PR; the caller or a human decides whether to open issues -->
### 1. <title>
...
```

The sections above `## Follow-up Candidates` are a contract that `implement-issue` reads: keep their headings and item shape exactly as shown. Never create GitHub issues in this mode.

## 9. Present the summary (all modes)

Show the review locally: a 2-4 sentence overview (what the PR does, whether the approach is sound, the recommendation: `Approve` / `Approve with minor fixes` / `Request changes`); issue alignment; required issues (with `file:line`, rationale, fix, or "None"); suggestions; positive observations. In `interactive` mode, append a recap of the user's decisions (finding -> what they chose) and the follow-up issues created.

## 10. Re-review cycle

If invoked again on the same PR after new commits:

1. Fetch the latest diff and the new commits since the last review.
2. Read replies to earlier inline comments: `gh api repos/$REPO/pulls/$PR_NUMBER/comments --paginate`.
3. Re-analyze the full current state (not just the new commits) with the same phase-3 parallel spawn.
4. Deduplicate against your own earlier review: do not re-raise findings already posted or already fixed.
5. Report which earlier findings were addressed and whether new ones appeared, then continue from phase 4 in the current mode.
6. (`interactive` only) When what is left is a 1-line fix, offer to make it directly instead of creating review churn: `git fetch && git checkout <branch>`, make the minimal commit, push, switch back.
