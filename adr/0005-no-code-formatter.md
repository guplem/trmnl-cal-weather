# No code formatter or linter

## Context

The three enforcement layers of the personal standard include a format gate "where a formatter is natural to the stack." This repo is a TRMNL plugin: a Liquid template with inline CSS and browser JS (`full.liquid`), a Google Apps Script file (`.gs`), YAML config, and a small set of extracted ES-module helpers under `src/lib/`. Liquid-with-inline-JS and Apps Script have no natural formatter, and running one over `full.liquid`/`.gs` risks reformatting the live, hand-tuned render code. A JS formatter (Prettier) could cover only `src/lib/`.

## Decision

Ship no formatter and no linter. The CI gate and the pre-commit hook run the tests only (`bun test .`). Style is kept by convention and by matching existing code (pattern-scout). This mirrors the owner's sibling Bun repo, which also runs tests-only with no formatter.

**Rejected alternative:** add Prettier over `src/lib/` only. Rejected for now because it would format only a small new slice while the bulk of the code (`full.liquid`, `.gs`) stays unformatted, giving an inconsistent gate for little value, and adding a dev dependency and a format-vs-test ordering to maintain.

## Consequences

**Positive:**

- No dependency to install for the gate; `bun test .` needs nothing extra.
- No risk of a formatter rewriting the live template or Apps Script code.

**Trade-offs and revisit conditions:**

- Style consistency rests on convention and review, not a tool.
- Revisit and add Prettier (scoped to `src/lib/`, excluding `full.liquid` and the `.gs`) if `src/lib/` grows large enough that hand-kept style drifts, or if a contributor other than the owner joins. Update this ADR in place when that happens.
