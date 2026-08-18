# joe-nutritionist

Joe's personal nutrition system: a voice-first daily nutrition dashboard plus the
weekly food-plan artefacts that feed it.

Everything here is built around one fixed set of daily targets:

| Target       | Value      |
| ------------ | ---------- |
| Calories     | 1,800 kcal |
| Protein      | 160 g      |
| Carbohydrate | 155 g      |
| Fat          | 60 g       |
| Fibre        | ≥ 30 g (hard minimum) |

## Repo map

| Path                       | What it is |
| -------------------------- | ---------- |
| `joe-gym-daily-nutrition/` | The dashboard app. Log meals in natural language (with voice input where the browser supports it), see daily totals, remaining macros and adaptive meal suggestions. |
| `docs/plans/`              | Plans written before building something. |
| `docs/solutions/`          | One doc per bug/gotcha already solved, grouped by category, with YAML frontmatter. **Read the relevant category before touching that area.** |
| `outputs/`                 | Generated deliverables. `weekly_food_plan_2026-08-15/` holds the weekly food plan workbook (`JOM_Gym_Weekly_Food_Plan.xlsx`) and the screenshots taken while verifying it. |
| `AGENTS.md`                | Project-wide rules and dated gotchas for any coding agent. Read first. |
| `joe-gym-daily-nutrition/AGENTS.md` | App-specific rules (nutrition-data conventions, parser rules). |

## The dashboard app

**Live: https://joe-nutritionist.vercel.app** — Vercel project
`joe-go-supernovas-projects/joe-nutritionist`, root directory `joe-gym-daily-nutrition/`.
Deploy with `vercel deploy --prod --cwd joe-gym-daily-nutrition`.

Stack: Next.js 16 (App Router) on Vercel, React 19, Tailwind 4. State lives entirely in
`localStorage` under `joe-gym-diary-v1` — there is no database. That makes the diary
**per-origin**: the phone and the laptop keep separate diaries, and moving one across takes
the topbar Export/Import controls.

Previously this ran as a Cloudflare Worker (`vinext`) hosted on OpenAI Sites. That was
migrated off in August 2026 when the Codex credits ran out; the Worker entry point, the
`@openai/sites-vite-plugin` config, the ChatGPT header auth and the unused Drizzle/D1
scaffold were all removed. Because the diary was origin-scoped `localStorage`, the topbar has
a one-time **Import** control that takes a JSON export from the old site.

Requires Node `>=22.13.0`.

```bash
cd joe-gym-daily-nutrition
npm install
npm run dev     # local development
npm run build   # verify the build output
npm test        # unit tests + build + rendered-output test
npm run lint
```

### Where the food numbers come from

Every food in `lib/food-parser.ts` carries a `source`: the Sainsbury's product Joe buys, its
URL, and the basis wording off that page — "per 100g" means different things for a raw pack and
a cooked-as-instructed one. UK labels report *available* carbohydrate with fibre listed
separately, so American figures for the same food are not interchangeable.

**Every food now has one.** `tests/food-data.test.ts` keeps it that way: a food without a
`source` fails the suite. Where Sainsbury's own listing carries no table the source is the
manufacturer (McCain) or the packaging as transcribed on Open Food Facts — and in the two cases
that used a community source, the figures matched the app's existing values to the decimal,
which is the corroboration that made them usable.

Getting there took three passes. The Sainsbury's API returns an empty `details_html`
intermittently, and some products publish only a per-bagel or per-tablespoon column, so six
foods looked unsourceable when in the end none were. Re-check, and look beyond one retailer,
before concluding a food cannot be sourced. Never fill one in from a similar product.

Quantities the app supplies rather than reads are flagged in the preview. There are two kinds,
and they are different: `"quantity"` (a food named with no amount — peanut butter could be 10g
or 40g) and `"portionSize"` (pieces counted, but what one piece weighs is a guess; the chicken
pack itself says "thigh fillet sizes also vary"). A food sold as whole units is *not* flagged
for a bare mention — "bagel" plainly means one bagel.

Suggestions in `lib/recommendations.ts` derive their macros from their own `logText`, so the
card and the resulting diary entry cannot disagree.

### Typing the macros yourself

Everything else in the app derives macros from a food. **Type the macros** in the add-food card
is the way in for anything the parser cannot read — a restaurant meal, a plate at someone
else's house — and the ✎ on any diary card corrects a meal that logged wrong.

A number Joe read off a menu beats anything the app derives, so a hand-entered meal is recorded
as the best source there is, not as an estimate. What stays visible is only that it came from
him: `Meal.macros` remains the single authority day totals read, `entered: "hand"` labels the
fact that it no longer matches the foods listed on the card, and `parsed` keeps whatever the
parser had worked out so the correction can be inspected and put back.

A blank required box fails the entry rather than defaulting to zero — a plate of food is not 0g
of protein. Fibre is the exception, counting as 0 with the meal marked, because it has to count
as something. With the other figures filled the form offers `4P + 4C + 9F + 2 fibre` as
something to tap; it is never applied on its own.

### Scanning a barcode

**Scan** in the add-food card opens the camera. A decoded barcode goes to `/api/barcode/[code]`,
which is an exact key into Open Food Facts — no ranking, no lookalikes. Name search is the last
resort now rather than the first, because it is what produced every wrong product this app has
had.

The barcode gets the right product; it does not make the numbers true. So the panel that comes
back is editable: correcting a figure against the packet in hand upgrades the food's provenance
from a database lookup to a reading, which is the best source the app has. Missing fibre shows
as "not published" and never as a measured zero — it is a hard 30g minimum, and a silent zero
eats it. A product with no energy figure is refused outright rather than becoming a
zero-calorie food.

State an amount and the sheet shows what it comes to and logs it as the meal you pick, without
leaving the scanner. **Just save it** adds the food without logging anything.

Saving writes a **pantry** entry to `localStorage` under `joe-gym-pantry-v1`, and scanned foods
sort *ahead* of `FOODS` wherever it is read. So a scanned jar behaves like anything else: "40g of it" works in
the add-food box, in a sentence mixing it with stocked foods, and in the chat. `FOODS` itself
is never mutated — its order is load-bearing and a test asserts every entry is sourced.

A scan may take a stocked food's name, and wins it: scan a salmon and call it "salmon", and
that is what "200g salmon" means from then on. The pack in your hand is more specific than a
generic entry sourced months ago, and the app says what it has taken over. Two *scans* sharing
a name is still refused — there is no more-specific one of those.

A barcode that is not in the database opens the same panel with empty fields, saved against
that code — so a miss costs one reading, not one per meal.

`BarcodeDetector` is Chromium-only, so on iOS the decoding is done by a WebAssembly build of
ZXing, lazy-loaded and served from `public/zxing_reader.wasm` rather than a CDN.
`tests/wasm-asset.test.ts` asserts that copy matches the installed package. Every camera
failure falls through to typing the digits.

Key modules:

- `app/page.tsx` — dashboard UI, including the calorie-composition wheel.
- `app/chat.tsx` — the "Ask" panel (streaming conversation).
- `app/scanner.tsx` — the barcode scanner sheet.
- `app/macro-fields.tsx` — the five macro boxes, shared by the scanner, the typed-entry form
  and the diary editor.
- `app/api/chat/route.ts` — Claude endpoint. Needs `ANTHROPIC_API_KEY`.
- `app/api/barcode/[code]/route.ts` — barcode lookup against Open Food Facts.
- `lib/food-parser.ts` — turns spoken/typed phrases into foods and amounts.
- `lib/barcode.ts` — reads a product off a barcode response, and what to refuse.
- `lib/pantry.ts` — scanned foods, and the alias collision check.
- `lib/macros.ts` — reading macros Joe typed, and what a blank box means.
- `lib/recommendations.ts` — adaptive suggestions for the remaining macros.
- `lib/nutrition-tools.ts` — the deterministic layer the chat calls.
- `tests/` — `food-parser`, `recommendations`, `nutrition-tools`, `barcode`, `pantry`,
  `macros`, and a rendered-HTML check.

### The Ask panel

Joe can ask *"I'm cooking three chicken thighs, how much rice?"* and get an exact gram
figure. The rule that makes it trustworthy: **Claude never does the arithmetic.** It picks a
tool; `lib/nutrition-tools.ts` computes the answer from the stored food values and returns it;
the system prompt forbids quoting any number that did not come back from a tool call.

`fitPortion` is the interesting one and it contains no AI at all — it scans portion sizes in
5g steps, rejects any that push calories, carbs or fat past target, and picks the minimum of
`scoreProjection()`, the same cost function the meal recommender already uses. Because it
scores against what is *left* of the day, a mostly-empty day yields a big portion and a
nearly-finished one yields a small one, with no separate rule needed.

`ANTHROPIC_API_KEY` is set on the Vercel project for **Production only** — add it to Preview
too if branch deployments ever need the chat.

**The production URL is currently public and unauthenticated.** `/api/chat` spends real
Anthropic credit on every request, and the 20/minute limit in the route is per warm instance,
so it is a runaway-client backstop rather than an access gate. Either turn on Vercel
deployment protection or put a shared secret in front of the route before sharing the link.

## Working conventions

- Read `AGENTS.md` and the matching `docs/solutions/` category before changing an area.
- Every nutrition value must record its basis (per 100 g / cooked / raw / per portion)
  and be scaled to the actual portion.
- Verification is not optional: a production build plus the relevant test, and a
  visual check for UI changes.
- After fixing a bug, add a `docs/solutions/<category>/` doc and a one-line dated
  entry in `AGENTS.md`.

## History note

The app's git history starts before this restructure, when the app was the repo
root. Use `git log --follow <path>` to trace a file across the move into
`joe-gym-daily-nutrition/`.
