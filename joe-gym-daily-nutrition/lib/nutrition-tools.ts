/**
 * The deterministic layer behind the chat.
 *
 * Every number Joe is shown comes from here, never from the language model. The model decides
 * *which* question to ask; these functions answer it by scaling the stored food values, exactly
 * as the rest of the app does. Keeping the arithmetic here is what makes the chat trustworthy:
 * a model that estimates macros produces confident, slightly-wrong grams, which is worse than
 * no answer at all.
 */
import { FOODS, parseFood, scaled, toStoredGrams, type Assumption, type CookState, type Food, type Macros, type ParsedFood } from "./food-parser";
import { DAILY_TARGETS, recommendDay, scoreProjection, type Suggestion } from "./recommendations";

export type DayState = { consumed: Macros; mealCount: number; hour: number };
/**
 * `portions` exists so the caller never multiplies. "Three chicken thighs" is `portions: 3`,
 * not `grams: 192` — asking a language model to do that multiplication is asking it to do
 * arithmetic, which is the one thing this layer exists to prevent.
 */
export type MealItem = {
  food: string;
  grams?: number;
  portions?: number;
  weighedAs?: CookState;
  /**
   * Macros per 100g for a food that is not in `FOODS` — either from `searchFoodDatabase` or read
   * off the packet by Joe. The scaling still happens here; this only supplies the numbers the
   * catalogue is missing, so the model never has to do the arithmetic itself.
   */
  per100g?: Macros;
};

const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };

const add = (a: Macros, b: Macros): Macros => ({
  calories: a.calories + b.calories,
  protein: a.protein + b.protein,
  carbs: a.carbs + b.carbs,
  fat: a.fat + b.fat,
  fibre: a.fibre + b.fibre,
});

const round1 = (value: number) => Number(value.toFixed(1));

const roundMacros = (m: Macros): Macros => ({
  calories: Math.round(m.calories),
  protein: round1(m.protein),
  carbs: round1(m.carbs),
  fat: round1(m.fat),
  fibre: round1(m.fibre),
});

const total = (items: ParsedFood[]): Macros => items.reduce((sum, item) => add(sum, item), ZERO);

/** What is left of each target. Negative means already over. */
export function remainingFor(consumed: Macros): Macros {
  return {
    calories: round1(DAILY_TARGETS.calories - consumed.calories),
    protein: round1(DAILY_TARGETS.protein - consumed.protein),
    carbs: round1(DAILY_TARGETS.carbs - consumed.carbs),
    fat: round1(DAILY_TARGETS.fat - consumed.fat),
    fibre: round1(DAILY_TARGETS.fibre - consumed.fibre),
  };
}

/**
 * Resolve a spoken food name to the stored entry, or null if Joe does not stock it.
 *
 * `pantry` carries the foods he has scanned. They are appended rather than merged into
 * `FOODS`, whose order is load-bearing.
 */
export function lookupFood(query: string, pantry: Food[] = []): Food | null {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return null;

  const catalogue = [...FOODS, ...pantry];
  const exact = catalogue.find((food) => food.aliases.includes(wanted) || food.name.toLowerCase() === wanted);
  if (exact) return exact;

  // Fall back to the same matcher the diary uses, so the chat and the log agree on names.
  const parsed = parseFood(wanted, pantry);
  if (parsed.items.length === 1) {
    return catalogue.find((food) => food.id === parsed.items[0].id) ?? null;
  }

  // Shorthand: Joe says "rice", the stored aliases are all "sticky rice" / "jasmine rice".
  // Prefer an alias whose *last* word is the query — in an English compound the head noun is
  // last, so "sticky rice" is a kind of rice whereas "rice cakes" is a kind of cake. Without
  // that rule the shorter "rice cakes" wins and the chat sizes the wrong food.
  const escaped = wanted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wholeWord = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`);
  const isHead = new RegExp(`(?:^|\\s)${escaped}$`);

  const partial = catalogue.flatMap((food) => {
    const alias = food.aliases.find((candidate) => wholeWord.test(candidate));
    return alias ? [{ food, alias, head: isHead.test(alias) ? 0 : 1 }] : [];
  }).sort((a, b) => a.head - b.head || a.alias.length - b.alias.length);

  return partial[0]?.food ?? null;
}

/** A food supplied per-100g by the caller, so it can be priced without being in the catalogue. */
function adHocFood(name: string, per100g: Macros): Food {
  return { id: `adhoc:${name.toLowerCase()}`, name, aliases: [], basis: "100g", ...per100g };
}

function resolveItem(item: MealItem, pantry: Food[]): { parsed: ParsedFood; food: Food } | { unknown: string } {
  // Explicit macros win over the catalogue: if Joe has read a label out, that beats a lookalike.
  const food = item.per100g ? adHocFood(item.food, item.per100g) : lookupFood(item.food, pantry);
  if (!food) return { unknown: item.food };

  const grams = item.grams ?? (item.portions !== undefined && food.portionGrams ? item.portions * food.portionGrams : undefined) ?? food.portionGrams ?? 100;
  // A counted portion is already on the food's own basis, so converting it as if it had been
  // weighed in the other state would apply the ratio twice.
  const weighedAs = item.grams !== undefined ? item.weighedAs : undefined;
  const storedGrams = toStoredGrams(food, grams, weighedAs);

  // Counting pieces of something whose pieces vary states a count, not a weight — the chat has
  // to be able to say so rather than quoting the total as if it were measured.
  // A portion-basis food is eaten as whole units, so no stated amount means one of them.
  const counted = item.portions !== undefined || food.basis === "portion";
  const assumed: Assumption | undefined =
    item.grams !== undefined ? undefined
      : counted ? (food.portionVaries ? "portionSize" : undefined)
        : "quantity";

  const parsed = {
    ...scaled(food, storedGrams),
    ...(storedGrams === grams ? {} : { weighedGrams: grams, weighedAs }),
    ...(assumed ? { assumed } : {}),
  };
  return { parsed, food };
}

export type PricedMeal = {
  items: ParsedFood[];
  unknown: string[];
  total: Macros;
  projected: Macros;
  remaining: Macros;
};

/** Exact totals for a proposed meal, plus where the day lands if Joe eats it. */
export function priceMeal(items: MealItem[], day: DayState, pantry: Food[] = []): PricedMeal {
  const parsed: ParsedFood[] = [];
  const unknown: string[] = [];

  for (const item of items) {
    const resolved = resolveItem(item, pantry);
    if ("unknown" in resolved) unknown.push(resolved.unknown);
    else parsed.push(resolved.parsed);
  }

  const mealTotal = total(parsed);
  const projected = add(day.consumed, mealTotal);

  return {
    items: parsed,
    unknown,
    total: roundMacros(mealTotal),
    projected: roundMacros(projected),
    remaining: remainingFor(projected),
  };
}

export type FittedPortion = {
  food: string;
  grams: number;
  display: string;
  item: ParsedFood | null;
  mealTotal: Macros;
  projected: Macros;
  remaining: Macros;
  limitedBy: string | null;
};

const STEP_GRAMS = 5;
const MAX_GRAMS = 800;

/**
 * Solve for how much of one food fits the rest of the day.
 *
 * Two rules, in order:
 *  1. Hard ceiling — never propose a portion that takes calories, carbs or fat past target.
 *     Fibre has no ceiling because it is a minimum, not a budget.
 *  2. Among the portions that clear that bar, pick the one minimising `scoreProjection` — the
 *     same cost function the meal recommender uses, so "a good day" means one thing in this
 *     app. Because it scores against what is *left*, a mostly-empty day naturally yields a
 *     big portion and a nearly-finished one yields a small one.
 */
export function fitPortion(args: { day: DayState; fixed: MealItem[]; variable: string; variablePer100g?: Macros; pantry?: Food[] }): FittedPortion {
  const pantry = args.pantry ?? [];
  const food = args.variablePer100g ? adHocFood(args.variable, args.variablePer100g) : lookupFood(args.variable, pantry);
  if (!food) throw new Error(`No stored food matches "${args.variable}". Look it up or read its label, then pass its per-100g macros.`);

  const fixedPriced = priceMeal(args.fixed, args.day, pantry);
  const base = add(args.day.consumed, total(fixedPriced.items));

  const ceilings: Array<[keyof Macros, number]> = [
    ["calories", DAILY_TARGETS.calories],
    ["carbs", DAILY_TARGETS.carbs],
    ["fat", DAILY_TARGETS.fat],
  ];

  let bestGrams = 0;
  let bestScore = scoreProjection(base);
  let limitedBy: string | null = null;

  for (let grams = STEP_GRAMS; grams <= MAX_GRAMS; grams += STEP_GRAMS) {
    const projected = add(base, scaled(food, grams));

    const breached = ceilings.find(([key, cap]) => projected[key] > cap);
    if (breached) {
      // Record what stopped us only if we had already banked a workable portion.
      if (bestGrams > 0) limitedBy = breached[0];
      break;
    }

    const score = scoreProjection(projected);
    if (score < bestScore) {
      bestScore = score;
      bestGrams = grams;
    }
  }

  const item = bestGrams > 0 ? scaled(food, bestGrams) : null;
  const mealTotal = add(total(fixedPriced.items), item ?? ZERO);
  const projected = add(args.day.consumed, mealTotal);

  return {
    food: food.name,
    grams: bestGrams,
    display: item ? item.display : `0g`,
    item,
    mealTotal: roundMacros(mealTotal),
    projected: roundMacros(projected),
    remaining: remainingFor(projected),
    limitedBy,
  };
}

export type MealSuggestion = Suggestion & { projected: Macros; remaining: Macros };

/** Rank the meals Joe can actually build, optionally filtered to a craving ("pasta"). */
export function suggestMeals(day: DayState, craving?: string): MealSuggestion[] {
  const plan = recommendDay(day.consumed, day.mealCount, day.hour);
  const wanted = craving?.trim().toLowerCase();

  const seen = new Set<string>();
  const candidates = [plan.next, ...plan.later, ...plan.choices.flatMap((choice) => [choice.next, ...choice.later])];

  return candidates
    .filter((meal) => {
      if (seen.has(meal.id)) return false;
      seen.add(meal.id);
      if (!wanted) return true;
      return `${meal.title} ${meal.items.join(" ")} ${meal.logText}`.toLowerCase().includes(wanted);
    })
    .map((meal) => {
      const projected = add(day.consumed, meal.macros);
      return { ...meal, projected: roundMacros(projected), remaining: remainingFor(projected) };
    });
}
