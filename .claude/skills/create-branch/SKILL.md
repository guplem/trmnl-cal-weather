---
name: create-branch
description: Create a git branch from a base and set its upstream at once, so a later push can never land on the base branch. Use when starting work that needs its own branch.
---

# Create a branch and set its upstream at once

> **SET THE UPSTREAM IMMEDIATELY**

The upstream is the remote branch that a plain `git push` writes to. `git checkout -b <branch> <base>` leaves the upstream pointing at `<base>`. This is **dangerous**: a later `git push` would push straight to the base branch, skipping the PR flow and the CI gate. So you **must** follow the checkout with `git push -u` right away to fix the upstream.

The user may name a **base branch**; if they do not, default to `origin/master`.

```bash
# Create the branch and set its upstream, chained so the push cannot be forgotten
git checkout -b <branch-name> <base> && git push -u origin <branch-name>
```

**Run both steps as one chained command** (`&&`) so the push cannot be forgotten or put off. Do not defer the push: the upstream is wrong from the moment you create the branch until `push -u` runs.

If you are already on the branch: `git push -u origin HEAD`.
