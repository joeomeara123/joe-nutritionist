# joe-nutritionist — agent guide

Personal nutrition system for Joe: the daily dashboard in `joe-gym-daily-nutrition/`
plus the weekly food-plan workbooks in `outputs/`. Start with `README.md` for the
repo map.

## Rules

- Daily targets are fixed: 1,800 kcal, 160g protein, 155g carbohydrate, 60g fat,
  and at least 30g fibre. Do not change them unless Joe explicitly says so.
- Fibre is a hard minimum, not a soft optimisation term.
- Every food value must state its basis: per 100g, cooked weight, raw weight or
  per portion. Scale every macro to the actual portion.
- Before changing an area, read the matching `docs/solutions/<category>/` docs.
- Verify before claiming done: production build plus the relevant tests, and a
  visual check for UI changes.
- After fixing a bug, write `docs/solutions/<category>/<slug>.md` (YAML frontmatter:
  title, category, date, symptom, status) and add a dated one-liner below.
- App-specific rules live in `joe-gym-daily-nutrition/AGENTS.md`.

## Project gotchas

- 2026-08-15: Soft macro optimisation allowed a 29.3g fibre day -> treat daily fibre as a hard minimum and fail workbook generation below 30g.
- 2026-08-15: Hand-counted spreadsheet row edits changed adjacent foods -> resolve rows from Day/Meal/Food keys and verify edited labels plus all daily totals before export.
- 2026-08-17: Per-100g rice values understated a 130g pot -> store nutrition basis and scale every macro to the full portion.
- 2026-08-17: Owner-only Sites deployment rejected the in-app browser session -> verify browser identity separately from Codex ownership before changing access mode.
- 2026-08-17: App and knowledge docs lived in two separate git repos -> single repo rooted at `JOM GYM`, app under `joe-gym-daily-nutrition/`, all docs under `docs/`; use `git log --follow` to trace pre-restructure history.
