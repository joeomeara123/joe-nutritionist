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
- 2026-08-17: Unmatched foods were dropped silently whenever anything else on the line matched -> parser blanks accounted-for spans and returns the remainder as `unknown`; oil and butter added to `FOODS`.
- 2026-08-17: "428g raw chicken thighs" logged one 64g thigh because the gram regex only tolerated `cooked` -> capture `cooked|raw` and convert raw weighings through `Food.rawYield`.
- 2026-08-17: Short aliases matched inside longer words (`oil` in `boiled`, `butter` in `peanut butter`) -> alias matching is word-boundary based and cooking fats are ordered last in `FOODS`.
- 2026-08-17: Food shorthand ranked by alias length resolved "rice" to `rice cakes` -> prefer the alias whose last word is the query (head noun), length only as tie-breaker.
- 2026-08-17: `npm test` reported a false failure and silently skipped a third of the suite -> Node tests need `--experimental-strip-types`; the Bun-authored tests need their own `bun test` script.
- 2026-08-17: Chat macro figures must never come from the model -> all arithmetic lives in `lib/nutrition-tools.ts` and reaches Claude only as tool results; the system prompt forbids unsourced numbers.
