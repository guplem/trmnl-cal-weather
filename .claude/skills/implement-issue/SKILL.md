---
name: implement-issue
description: Implement a GitHub issue step by step - ask about the branch, the PR target, and the phases first, then run the work and the review cycle with the review-pr skill. Use whenever the user asks to implement, work on, or execute a GitHub issue.
argument-hint: [issue-number]
---

# Implement a GitHub issue

Implement a GitHub issue by gathering a little configuration through questions, then doing the work step by step, with a PR and a review cycle for each step. ("Issue" here means a GitHub issue, the tracked unit of work.)

## 1. Determine the issue

- If `$ARGUMENTS` has an issue number, use it as `ISSUE`.
- If `$ARGUMENTS` is empty, ask via `AskUserQuestion`: "Which GitHub issue do you want to implement?"

## 2. Fetch and read the issue

```bash
gh issue view $ISSUE --json title,body,number,labels
```

Show the title so the user can confirm you have the right issue. Read the body for sub-issue references (`#<number>`) and any numbered phase or step structure. If the issue carries a `waiting-for-*` label (a label that marks it as not yet reviewed by a human), tell the user and ask whether to go ahead anyway.

## 3. Ask: working branch

Ask via `AskUserQuestion`: a new branch or the current one? If new, ask for the name, then create it **with the upstream set at once** (the `create-branch` skill): `git checkout -b <branch> && git push -u origin <branch>`. If it already exists: `git checkout <branch> && git pull origin <branch>`. Store it as `WORK_BRANCH`.

## 4. Ask: PR target branch

Ask via `AskUserQuestion`: `master` / the current branch / a custom one. Store it as `PR_TARGET_BRANCH`.

## 5. Analyze the steps

- **If the issue has explicit phases or sub-issues:** show them and ask which to implement (or all, in order). If a sub-issue depends on another that has not merged yet, stack the PRs: branch from the dependency's branch and target it, so GitHub retargets the PR automatically when the dependency merges.
- **If it has no explicit steps:** judge whether splitting into steps makes sense (separate changes, different areas, natural dependency boundaries). If yes, propose the split via `AskUserQuestion`; if no, implement it as a single unit.

## 6. Check the starting state

1. `git checkout $WORK_BRANCH && git pull origin $WORK_BRANCH`
2. Spawn the **validate** agent to confirm the repo's checks pass before you start. Do not build on a broken baseline; report it to the user instead.

## 7. Do the work

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

5. **Run the review cycle** (Section 8) before moving to the next step.

## 8. Review cycle (uses the review-pr skill)

Use the **review-pr** skill in `--no-verdict` mode. That mode runs unattended (it never asks the user anything), posts a COMMENT-only review to the PR, and writes a local findings file `.reviews/<PR_NUMBER>-review.md` with a clear verdict: `APPROVED` or `CHANGES_REQUESTED`. Invoke it with the Skill tool: `skill: "invoke", args: "review-pr <PR_NUMBER> --no-verdict"`.

1. Run `review-pr <PR_NUMBER> --no-verdict`, then read the verdict from `.reviews/<PR_NUMBER>-review.md`.
2. **If `CHANGES_REQUESTED`:** spawn an implementation agent on the same branch to fix every Required item, then run `review-pr <PR_NUMBER> --no-verdict` again (it re-reviews the whole current state and does not re-raise findings it already made). Repeat until `APPROVED`, **at most 3 rounds**; then stop and report to the user.
3. **On approval, reply on every inline comment thread the cycle posted**, so a human scanning the "Files changed" tab sees each comment's status without reading commits. Do **not** resolve threads (that is the human's call). List the comment `id`s with `gh api repos/<owner>/<repo>/pulls/<PR_NUMBER>/comments --jq '.[] | {id, path, line}'`, then reply to each via the replies endpoint:
   ```bash
   gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/pulls/<PR_NUMBER>/comments/<COMMENT_ID>/replies -f body="<reply>"
   ```
   - **Addressed by a fix round:** `**Applied** in <short-sha> - <one sentence on the change>.`
   - **Left unapplied on purpose** (optional suggestion, out of scope): `**Not applied** - <one-sentence reason>.`
4. **Then finish:** delete the review file (and `.reviews/` if it is now empty) and tell the user.

**Do not merge the PR.** This repo uses the manual-review flow: wait for the user to review, approve, and merge.

## 9. Completion

Report which steps are done and which remain. If steps remain: "Run `/implement-issue <ISSUE>` to continue."

## Important rules

- **Never push to `master` directly.** All work goes through branches and PRs.
- **Scope discipline.** Each agent works only on its assigned step; no cross-step changes.
- **Verification is mandatory.** The implementation agent runs `bun test .` before pushing, and the orchestrator confirms a clean state with the **validate** agent.
- **Fresh reviewers.** The review agent has no context from the implementation (the `review-pr` skill already spawns fresh agents).
- **Bounded iteration.** At most 3 review rounds; then report to the user instead of looping.
- **Interactive first.** Gather configuration via `AskUserQuestion`; never assume defaults silently.
