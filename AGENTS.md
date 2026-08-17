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
- 2026-08-17: Model passed `grams: 64` for "three thighs" because the tool made it multiply 3x64 -> `MealItem.portions` takes the count and the tool does the multiplication; verifying tool *outputs* does not catch a bad tool *input*.
- 2026-08-17: `.env.local` present and valid but the key still missing -> either a stray parent lockfile moved Next's project root (pin `outputFileTracingRoot`/`turbopack.root`), or an empty exported `ANTHROPIC_API_KEY` shadowed it (dotenv never overrides a defined var; use `env -u`).
- 2026-08-17: Chat replies rendered as plain text, so markdown from the model showed literal `**asterisks**` -> the system prompt asks for plain prose rather than adding a renderer.
- 2026-08-17: Numerals were not counts and bracketed weights were invisible, so "3 chicken thighs (392g uncooked)" logged one 64g thigh -> `COUNT` accepts digits and `gramsAfter` skips leading brackets.
- 2026-08-17: `(cooked|raw)` could not match "uncooked", and the failure discarded the whole stated weight rather than just the basis -> alternation is `uncooked|cooked|raw`, longest first, because `cooked` is a prefix of `uncooked`.
- 2026-08-17: "2 teaspoons of pesto" fell through to the 100g default, inventing 455 kcal -> spoons are a quantity, condiments carry a serving size, and any quantity the parser supplies is flagged `assumed` and shown in amber.
- 2026-08-17: Food macros had no provenance, mixing Sainsbury's labels with American figures -> every food carries a `source` (product, URL, basis); the six Sainsbury's publishes no table for are asserted by name in `tests/food-data.test.ts` and marked `[ESTIMATE]` to the chat.
- 2026-08-17: Sainsbury's blocks curl but a real Chrome can call their JSON API from page context; detail returns the product bare while search wraps it in `products[]`, the energy row drops its label cell and shifts the columns, and one product can publish both dry and cooked "per 100g" columns.
- 2026-08-17: Keyword search picks the wrong product (whipped feta, flavoured rice) -> rank candidates by distance from the macros already stored, after scaling portion-basis foods to per 100g.
- 2026-08-17: Letting the forward weight scan skip `[\s,(]*` made it cross a comma, so "chicken thighs, 100g pasta" gave the chicken the pasta's weight -> skip whitespace only; brackets are neutralised to spaces at normalise time, which keeps every index aligned.
- 2026-08-17: `rawYield` assumed every food is stored cooked, so "225g of cooked pasta" was priced as 225g dry -> `weighedAs` + `cookedRatio` (cooked mass / uncooked mass) and one shared `toStoredGrams`; meat converts down from uncooked, pasta converts down from cooked.
- 2026-08-17: The chat dead-ended on any food outside `FOODS`, correctly refusing to guess but offering no way forward -> `search_food_database` (Open Food Facts, no bot protection, works from serverless) plus `MealItem.per100g` for label figures Joe reads out; arithmetic still lives in TypeScript.
- 2026-08-17: "I won't guess" is only half a rule -> it needs "and here is how I find out instead", or a correct refusal becomes a dead end.
- 2026-08-17: A converted weight is not the number Joe typed -> the chip shows "from 225g cooked" so it does not read as a mistake.
- 2026-08-17: `recommendations.ts` hardcoded meal macros *and* a `logText` the parser read differently -> suggestions derive macros from their own `logText`; the change immediately exposed "one Veetee sticky rice pot" reporting `pot` as an unknown food.
