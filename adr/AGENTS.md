# Architecture Decision Records (ADRs)

This directory holds the Architecture Decision Records for the TRMNL Calendar + Weather Plugin.

## What is an ADR?

An ADR records one architectural decision or cross-cutting standard, with its context, the decision, and its consequences. It answers "how do we always do X here": the middleware data layer, the full-view-only layout, the 2-bit palette constraint, the testing strategy.

An ADR is **not** a feature explanation and not a setup guide. How the project works and how to run it belongs in `README.md` (and `MIDDLEWARE_SETUP.md`). See the "Documentation Organization" section of the root `AGENTS.md` for the full map of what goes where.

## ADRs are living: update, do not supersede

One ADR describes one pattern for its whole life. When the pattern changes, **edit that ADR in place** so it always matches the current design. Do not create a successor ADR or a "Superseded by" chain to record an update.

Create a **new** ADR only when a genuinely new pattern appears that no existing ADR covers. Most changes need no ADR at all. History lives in git; add a short inline "Rejected alternative" note only when the old approach is easy to fall back into and harmful.

## Numbering and template

`NNNN-short-descriptive-title.md`, sequential, never renumbered. Gaps from removed ADRs are fine. Use `TEMPLATE.md` as the starting point: Context, Decision, Consequences.

## What does NOT warrant an ADR

- A change that fits an existing ADR: **update that ADR** instead of writing a new one.
- Standard library or framework usage, one-off bug fixes, minor refactors.
- Anything a reader can derive from the code or from `README.md`.

## Creating or updating an ADR

Use the **adr-checker** agent. It enforces the full rules (one decision per ADR, <= 2 pages, alternatives with rejection rationale, update-in-place, source-of-truth-is-the-code) and writes the file. Index every ADR as a one-line row in the root `AGENTS.md`.
