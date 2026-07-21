---
name: write-commit
description: Shape git commits well - atomic one-concern commits, conventional-commit subjects, why-focused bodies, and a branch history that reads as a clear story. Use when composing commits.
---

# Commit shape and message discipline

This skill covers *how* to shape a commit. Whether you are allowed to commit at all is a separate matter set by the user's own configuration, not by this skill.

Treat committing as part of the deliverable. The next person to read `git log` should be able to reconstruct *what you did and why* without diffing the code.

- **Atomic commits, one concern each.** Split unrelated changes into separate commits, even when you made them in the same session. A follow-up refactor, a doc update, and a test addition are three commits, not one. If `git diff --stat HEAD` would touch files from three separate concerns, plan three commits. Do not bundle "for tidiness": bundling destroys reviewability and the ability to bisect (find the commit that introduced a bug by binary search).
- **Group by intent, not by file.** A commit titled `"various fixes"` or `"address feedback"` is almost always wrong: it means changes from several concerns were collapsed together. Title each commit after the one thing it does, and put unrelated work in a sibling commit.
- **Subject plus body, not subject only.** The subject says what changed in at most 72 characters, with a conventional-commit prefix (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`). The body explains *why*: the constraint that forced this shape, the previous behavior, the failure it prevents, the ADR / issue / review comment that motivated it. A trivial commit (a one-line typo) can skip the body; anything non-trivial needs one.
- **Write the message for a human skimming later.** Follow the repo's **Communicating with users** style (`AGENTS.md`): the message is read in `git log` and code review, often skimmed, so lead with what changed and why in short plain sentences, and gloss any jargon.
- **Branch history reads as a clear story.** Someone scrolling `git log --oneline <base>..HEAD` should follow the work step by step, in the order it happened: foundational refactors land before the feature that needs them; tests ship in or right after the commit they cover; doc updates land with the code they describe, not in a trailing "docs" dump. If your branch ends with one 800-line commit titled `"implement feature"`, reshape the history before pushing.
- **Pre-commit check.** Before each `git commit`, ask: *what single sentence sums up the diff I am about to commit, and would the next reader agree that sentence is faithful?* If the answer needs an "and", split the commit.
- **Hard mechanics.** Never `--amend`, never `--no-verify`, never force-push. If a pre-commit hook fails, fix the problem and make a new commit.
