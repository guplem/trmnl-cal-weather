---
name: implement-issue
description: Implement a GitHub issue step by step - ask about the branch and the PR target first (batched in one question), then run the work and the review cycle with the review-pr skill. Also accepts a plain problem description, which it files as an issue autonomously first. Use whenever the user asks to implement, work on, or execute a GitHub issue.
argument-hint: [issue-number | problem description]
---

# Implement a GitHub issue

Implement a GitHub issue by gathering a little configuration through questions, then doing the work step by step, with a PR and a review cycle for each step. ("Issue" here means a GitHub issue, the tracked unit of work.)

## 1. Determine or create the issue

Read `$ARGUMENTS`:

- **An issue number** (digits, with or without a leading `#`): use it as `ISSUE`.
- **A problem description** (any other non-empty text): file it as an issue **autonomously** with the `create-issue` skill, then use the new number as `ISSUE`. Invoke it with the Skill tool: `skill: "create-issue", args: "<the description> --autonomous"`. Autonomous mode asks the user nothing: it infers the type, picks the title, drafts the body, and creates the issue on its own (see the `create-issue` skill's autonomous mode). Do not stop to confirm; the review cycle later is the safety net.
- **Empty**: ask via `AskUserQuestion`: "Which GitHub issue do you want to implement?"

## 2. Fetch, read, and take ownership

```bash
gh issue view $ISSUE --json title,body,number,labels
```

Show the title so the user can confirm you have the right issue. Read the body for sub-issue references (`#<number>`) and any numbered phase or step structure. If the issue carries a `waiting-for-*` label (a label that marks it as not yet reviewed by a human), tell the user and ask whether to go ahead anyway.

**Self-assign the issue**, because you are taking ownership of the work:

```bash
gh issue edit $ISSUE --add-assignee @me
```

## 3. Ask: branches (one batched question)

Ask both branch decisions in a **single `AskUserQuestion` call** (two questions in one batch), so the user answers them almost instantly from pre-filled options:

- **Working branch**: `New branch: <issue-number>-<short-slug>` (Recommended, slug derived from the issue title) / `Current branch`. The "Other" field takes a custom branch name. Store the choice as `WORK_BRANCH`.
- **PR target branch**: `master` (Recommended) / `Current branch`. The "Other" field takes a custom target. Store it as `PR_TARGET_BRANCH`.

Then set the working branch up **with the upstream set at once** (the `create-branch` skill). New branch: `git checkout -b <branch> && git push -u origin <branch>`. Existing branch: `git checkout <branch> && git pull origin <branch>`.

## 4. Analyze the steps

- **If the issue has explicit phases or sub-issues:** show them and ask which to implement (or all, in order). If a sub-issue depends on another that has not merged yet, stack the PRs: branch from the dependency's branch and target it, so GitHub retargets the PR automatically when the dependency merges.
- **If it has no explicit steps:** judge whether splitting into steps makes sense (separate changes, different areas, natural dependency boundaries). If yes, propose the split via `AskUserQuestion`; if no, implement it as a single unit.

## 5. Check the starting state

1. `git checkout $WORK_BRANCH && git pull origin $WORK_BRANCH`
2. Spawn the **validate** agent to confirm the repo's checks pass before you start. Do not build on a broken baseline; report it to the user instead.

## 6. Do the work

For each step (or the single unit):

1. **Create the step branch** (multi-step mode only; in single-issue mode you work directly on `$WORK_BRANCH`). Use the `create-branch` skill: `git checkout -b <issue-number>-<short-slug> $WORK_BRANCH && git push -u origin <issue-number>-<short-slug>`.

2. **Explore first (preparation).** As the orchestrator, launch the explore agents now and keep their reports for the next sub-step (the implementation agent below cannot spawn its own subagents, so this must happen here):
   - **pattern-scout** (always): how are similar things built in this codebase?
   - **adr-checker** in consult mode (only when the work touches an ADR-relevant area): which recorded decisions must the work follow?

3. **Spawn the implementation agent** (Agent tool, `isolation: "worktree"`), pasting the explore reports into its prompt:

   > You are implementing GitHub issue #<NUMBER> for the TRMNL Calendar + Weather Plugin.
   >
   > ## Issue
   > <full title and body>
   >
   > ## Step to implement
   > <the specific step, or "the full issue" in single-issue mode>
   >
   > ## Findings from the explore agents (follow these)
   > <paste the pattern-scout report, and the adr-checker report when there is one>
   >
   > ## Instructions
   > 1. Read `AGENTS.md` (and the relevant `src/AGENTS.md` / `src/middleware/AGENTS.md`) for conventions, gotchas, and the check command.
   > 2. **Diagnose first:** find the exact files and locations to change. Explain the reasoning before writing any code.
   > 3. **Plan if complex:** if the change touches more than 2 files, write a checklist of every required change first.
   > 4. **Red-green TDD, as `AGENTS.md` mandates:** write the failing `bun test` that pins each behavior before the code that makes it pass. A bug fix starts with a test that reproduces the bug. This applies to the pure logic in `src/lib/`.
   > 5. Implement, following the explore findings and the issue.
   > 6. **Keep the inline copies in sync (ADR 0006):** if you changed a pure helper inline in `full.liquid` or the `.gs`, update the matching `src/lib/*.js` and its test, and vice versa; keep them behavior-identical. If you changed the `.gs`, bump `MIDDLEWARE_VERSION`.
   > 7. Run the repo's check yourself (`bun test .`; you cannot spawn the validate agent from inside here) and fix every failure you introduced before finishing.
   > 8. Make atomic conventional commits (the `write-commit` skill shape).
   > 9. Push your branch: `git push origin HEAD`.
   >
   > ## Branch
   > Work on `<branch>`; the base branch is `$WORK_BRANCH`.
   >
   > ## Scope
   > Implement only what the step describes. Do not touch code outside that scope. Do not change any published `.../blob/master/...` URL or the polling-URL contract.

4. **Create the PR** (always label and self-assign):

Write the PR description in the repo's **Communicating with users** style (`AGENTS.md`): a reviewer skims it, so lead with what changed and why, in short plain sentences.

```bash
gh label create "waiting-for-human-check" --description "No human has verified this yet -- direct AI output" --color "D93F0B" 2>/dev/null || true
gh pr create \
  --base $PR_TARGET_BRANCH \
  --head <branch> \
  --title "<conventional-prefix>: <short title>" \
  --assignee @me \
  --label "waiting-for-human-check" \
  --body "$(cat <<'PREOF'
## Summary

Closes #<ISSUE_NUMBER>

<1-3 bullet points on what was done>

## Test plan

- [ ] `bun test .` passes
- [ ] Manual verification via `trmnlp serve` (visual render) when the template or a rendered helper changed

🤖 Generated with [Claude Code](https://claude.com/claude-code)

PREOF
)"
```

5. **Run the review cycle** (Section 7) before moving to the next step.

## 7. Review cycle (uses the review-pr skill)

Use the **review-pr** skill in `--no-verdict` mode. That mode runs unattended (it never asks the user anything), posts a COMMENT-only review to the PR, and writes a local findings file `.reviews/<PR_NUMBER>-review.md` with a clear verdict: `APPROVED` or `CHANGES_REQUESTED`. Invoke it with the Skill tool: `skill: "invoke", args: "review-pr <PR_NUMBER> --no-verdict"`.

1. Run `review-pr <PR_NUMBER> --no-verdict`, then read the verdict and every finding from `.reviews/<PR_NUMBER>-review.md`.

2. **Decide what to implement, using your judgement on every comment, not only the Required ones.** Always implement each `[Required]` finding. For each `[Suggestion]` and `[Nitpick]`, weigh whether it is worth doing now: is it a real bug or correctness gap? how much tech debt (future cost) does leaving it create? is it a small fix that makes later work easier? does it fit the issue's scope? Implement the ones your judgement says are worth it; leave the rest, each with a clear reason. Do not treat "not Required" as "not worth doing".

3. **Apply the chosen fixes** by spawning an implementation agent on the same branch, then run `review-pr <PR_NUMBER> --no-verdict` again (it re-reviews the whole current state and does not re-raise findings it already made). Repeat until there are no new findings you choose to act on, **at most 3 rounds**; then stop and report to the user.

4. **Reply on every inline comment thread the cycle posted**, so the PR owner sees each comment's status and the reason without reading commits. List the comment `id`s with `gh api repos/<owner>/<repo>/pulls/<PR_NUMBER>/comments --jq '.[] | {id, path, line}'`, then reply to each via the replies endpoint:
   ```bash
   gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/pulls/<PR_NUMBER>/comments/<COMMENT_ID>/replies -f body="<reply>"
   ```
   - **Implemented:** `**Applied** in <short-sha> - <one sentence on the change>.`
   - **Left unapplied on purpose:** `**Not applied** - <one-sentence reason>.`

5. **Resolve each thread after you reply to it**, so only threads still needing the human's attention stay open. GitHub resolves review threads through its GraphQL API (there is no plain `gh pr` command). First list the threads with their IDs, then resolve each:
   ```bash
   OWNER_REPO=$(gh repo view --json owner,name -q '.owner.login+" "+.name')
   gh api graphql -f query='query($o:String!,$n:String!,$pr:Int!){ repository(owner:$o,name:$n){ pullRequest(number:$pr){ reviewThreads(first:100){ nodes{ id isResolved comments(first:1){ nodes{ databaseId } } } } } } }' -F o=<owner> -F n=<repo> -F pr=<PR_NUMBER>
   gh api graphql -f query='mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}){ thread{ isResolved } } }' -F id=<THREAD_ID>
   ```
   The thread nodes carry the first comment's `databaseId`, so you can match a thread to the comment you replied to.

6. **Reflect, then update the shared docs (do this every cycle).** For each finding you acted on, ask: "Is this a standard or best practice I should have followed from the start?" If yes, classify why the miss happened and fix the cause, so the same mistake does not recur:
   - **Guidance already existed** (in `AGENTS.md`, an area doc, an ADR, or a skill): no doc change; you simply missed it.
   - **Guidance was missing:** add it to the right shared file via the `write-ai-instructions` skill (`AGENTS.md` or the area doc for a rule, an ADR for a decision, a skill for a procedure).
   - **Guidance was weak or hard to find:** sharpen or relocate it.

   Persist every such lesson only in these **shared, version-controlled files** that all coworkers and their agents read; never in your personal memory or the user's global config, which teammates never see. Ride these doc changes along in the same PR and list them in the PR summary.

7. **Then finish:** delete the review file (and `.reviews/` if it is now empty) and tell the user.

**Do not merge the PR.** This repo uses the manual-review flow: wait for the user to review, approve, and merge.

## 8. Completion

Report which steps are done and which remain. If steps remain: "Run `/implement-issue <ISSUE>` to continue."

## Important rules

- **Never push to `master` directly.** All work goes through branches and PRs.
- **Take ownership.** Self-assign the issue when you start it and self-assign every PR you open.
- **Scope discipline.** Each agent works only on its assigned step; no cross-step changes.
- **Verification is mandatory.** The implementation agent runs `bun test .` before pushing, and the orchestrator confirms a clean state with the **validate** agent.
- **Fresh reviewers.** The review agent has no context from the implementation (the `review-pr` skill already spawns fresh agents).
- **Bounded iteration.** At most 3 review rounds; then report to the user instead of looping.
- **Judgement on every comment.** Act on any comment worth acting on, not just the Required ones; reply and resolve each thread with the reason.
- **Learn in shared docs.** When feedback reveals a should-have-known standard, persist the lesson to `AGENTS.md`/area doc/ADR/skill, never to personal memory or global config.
- **Config is interactive, the issue write-up is autonomous.** Gather the branch and step config via `AskUserQuestion` (batched where possible); when given only a problem description, create the issue with `create-issue --autonomous` and ask nothing.
</parameter>
</invoke>
