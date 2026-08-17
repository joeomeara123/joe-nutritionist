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

Stack: vinext (Next-style App Router on Vite/RSC) → Cloudflare Workers, React 19,
Tailwind 4, Drizzle (schema present, D1 binding not yet enabled). Hosted on
OpenAI Sites — see `joe-gym-daily-nutrition/.openai/hosting.json`.

Requires Node `>=22.13.0`.

```bash
cd joe-gym-daily-nutrition
npm install
npm run dev     # local development
npm run build   # verify the build output
npm test        # build + rendered-output test
npm run lint
```

Key modules:

- `app/page.tsx` — dashboard UI, including the calorie-composition wheel.
- `lib/food-parser.ts` — turns spoken/typed phrases into foods and amounts.
- `lib/recommendations.ts` — adaptive suggestions for the remaining macros.
- `tests/` — `food-parser`, `recommendations`, and a rendered-HTML check.

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
