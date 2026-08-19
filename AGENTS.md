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
- 2026-08-18: Searching by name is what produced every wrong product (whipped feta, flavoured rice, a Canadian cake for "Sainsbury's peanut butter") -> scan the barcode instead; `/api/barcode/[code]` is an exact key, and name search is now the last resort rather than the first.
- 2026-08-18: Open Food Facts publishes 0.5g and 4.2g of fibre for the same Sainsbury's Greek yogurt and omits it entirely on others -> `ScannedMacros.fibre` is `number | null`; a missing figure shows as "not published" and never as a measured zero, because fibre is a hard minimum.
- 2026-08-18: A missing energy figure would have read as a zero-calorie food -> a product without kcal/protein/carbs/fat is refused with `no-nutrition`; kilojoules are the only accepted substitute, converted at 4.184 and flagged.
- 2026-08-18: The name-search endpoint `/cgi/search.pl` began returning 503 and `!response.ok` mapped to an empty array, so an outage told Joe a food did not exist -> `searchFoodDatabase` returns `{ foods, unreachable }` and the barcode route treats only a 404 as a genuine absence.
- 2026-08-18: A new food name can silently disable an old one -> `aliasCollision` checks both directions on word boundaries; "oil" is swallowed by "olive oil" and "english butter" by "butter", so both are refused as names.
- 2026-08-18: Scanned foods are appended to `FOODS` at call time via `parseFood(text, extra)` and `lookupFood(query, pantry)`, never merged into it — `FOODS` ordering is load-bearing and its completeness is asserted by a test.
- 2026-08-18: `BarcodeDetector` is Chromium-only and Joe scans on an iPhone -> the `barcode-detector` ponyfill decodes in WebAssembly on Safari; the `.wasm` is served from `public/` rather than a CDN and `tests/wasm-asset.test.ts` asserts the copy is current.
- 2026-08-18: Chrome's own detector hides the WebAssembly path in tests -> delete `window.BarcodeDetector`, render an EAN-13 to a Y4M and pass it as `--use-file-for-fake-video-capture` to exercise the leg iOS actually takes.
- 2026-08-18: Macros were only ever derived from a food, so an unreadable meal had no way in and a mis-parsed one no way out -> `lib/macros.ts` plus a "Type the macros" mode and an edit affordance on each diary card; a figure Joe read off a menu beats anything the app derives, so it is recorded as the best source rather than a fallback.
- 2026-08-18: A corrected meal's totals stop matching the foods listed on its card -> `Meal.macros` stays the single authority, `entered: "hand"` labels the divergence and `parsed` keeps the parser's original so it is inspectable and revertible; an *unlabelled* disagreement is the `recommendations.ts` bug.
- 2026-08-18: A blank required macro box must fail the entry, not default to 0 — a plate of food is not 0g of protein; fibre is the only one that may be blank, counting as 0 with `fibreUnknown` set.
- 2026-08-18: Calories from `4P + 4C + 9F + 2fib` are offered as a tap, never applied automatically — Atwater factors approximate a label rather than reproducing it.
- 2026-08-18: `seedMeal` read `FOODS[13]`, which stopped being Nando's sauce once spring onions were inserted above it, so the card said one thing and logged 20g of oven chips -> resolve foods by id; never index `FOODS` positionally.
- 2026-08-18: Scanning ended at a preview elsewhere on the page, so "scan it and log 240g" still needed a button Joe had to go and find -> the scan sheet shows what the amount comes to and logs it, with the meal selector alongside because the one on the page sits behind the overlay.
- 2026-08-18: The running total in the scan sheet goes through `parseFood` against the food about to be saved rather than multiplying in the component — one code path is what stops the sheet and the diary disagreeing.
- 2026-08-18: Refusing a clashing name blocked the first real scan: "salmon", "salmon fillet" and "sainsbury's salmon" were all rejected because a generic `salmon` was stocked -> a scan now TAKES a stocked food's name and says so; scanned foods sort ahead of `FOODS` in `parseFood`/`lookupFood`. Clashing with another scan is still refused.
- 2026-08-19: "150g of uncooked pesto pasta" priced 150g of PESTO, because each food grabbed the weight directly in front of its own name and the sauce sat between the number and the pasta -> `parseFood` locates every food first, then assigns amounts rightmost-first (English compounds are head-final) and blanks each claimed amount so no two foods read the same number.
- 2026-08-19: The head of a compound reaches across one adjacent food name to find its weight; the cost is that two foods with no conjunction ("chicken thighs broccoli") read as one dish and the weight lands on the last. Pinned by a test as a known trade-off; the loser is flagged `assumed`.
- 2026-08-19: A phone keyboard types a curly apostrophe, so "Nando’s" off Joe's iPhone never matched the stored "nando's" -> swap `’` for `'` at normalise time, one-for-one so indices stay aligned. Never strip characters during normalisation.
- 2026-08-19: "192g cooked chicken" logged 138g — "cooked" is inside the alias `cooked chicken`, so the basis scan found nothing and the weight defaulted to uncooked -> an alias that opens with a basis word is stating one.
- 2026-08-19: The dashboard's own example meal could not be parsed back into itself (missing `nando's sauce` alias). If a string is both display text and parser input, assert the round trip.
