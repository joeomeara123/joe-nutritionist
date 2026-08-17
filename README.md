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

Stack: Next.js 16 (App Router) on Vercel, React 19, Tailwind 4. State lives entirely in
`localStorage` under `joe-gym-diary-v1` — there is no database.

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

Key modules:

- `app/page.tsx` — dashboard UI, including the calorie-composition wheel.
- `app/chat.tsx` — the "Ask" panel (streaming conversation).
- `app/api/chat/route.ts` — Claude endpoint. Needs `ANTHROPIC_API_KEY`.
- `lib/food-parser.ts` — turns spoken/typed phrases into foods and amounts.
- `lib/recommendations.ts` — adaptive suggestions for the remaining macros.
- `lib/nutrition-tools.ts` — the deterministic layer the chat calls.
- `tests/` — `food-parser`, `recommendations`, `nutrition-tools`, and a rendered-HTML check.

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

Set `ANTHROPIC_API_KEY` in the Vercel project. The route holds an API key, so keep Vercel
deployment protection on — the in-process rate limit is a backstop, not the gate.

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
