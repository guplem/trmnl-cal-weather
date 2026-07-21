---
name: rename-symbol
description: Rename or refactor a symbol safely by searching every naming-case variant across code, tests, docs, configs, and JSON. Use when renaming any identifier so no reference is missed.
---

# Rename a symbol safely

When you rename or refactor any symbol, search **all** naming variants (camelCase, PascalCase, snake_case, kebab-case, UPPER_CASE) across the whole project (code, tests, docs, configs, and YAML/JSON), not just the obvious code references. A missed variant in a config key or a data file is the usual cause of a rename that runs fine but breaks at runtime.

Extra traps in this repo:

- **Extracted helpers exist in two copies (ADR 0006).** A pure helper lives both in `src/lib/*.js` (with its `*.test.js`) and inline in `src/full.liquid` or `src/middleware/calendar_weather_proxy.gs`. Rename it in every copy and its test, and update the extracted-helper table in `src/AGENTS.md`. Renaming only `src/lib` leaves the live code calling the old name.
- **Plugin config keys are a contract, not free names.** The `keyname` values in `src/form_fields.yml` and the `custom_fields` keys in `.trmnlp.yml` are read by TRMNL and by `full.liquid` (e.g. `trmnl.plugin_settings.custom_fields_values.<keyname>`). Renaming a key means renaming it in the template read, the form field, and the trmnlp sample data together.
- **Middleware `CONFIG` keys and the `?src=...` / URL parameter names** (`token`, `src`, `tz`, `lat`, `lon`) are part of the polling-URL contract documented in `MIDDLEWARE_SETUP.md` and baked into the published recipe. Renaming one breaks live deployments; treat it as a contract change, not a local rename.
- **The published `.../blob/master/...` URLs** in `form_fields.yml` point at real repo paths; renaming a file changes those URLs. Do not break them.
