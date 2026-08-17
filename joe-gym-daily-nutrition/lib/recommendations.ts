import { parseFood } from "./food-parser";

export type MacroTotals = { calories: number; protein: number; carbs: number; fat: number; fibre: number };

export type Suggestion = {
  id: string;
  kind: "meal" | "snack";
  title: string;
  items: string[];
  logText: string;
  macros: MacroTotals;
};

export type PlanChoice = {
  next: Suggestion;
  later: Suggestion[];
  projected: MacroTotals;
  gaps: MacroTotals;
  note: string;
};

export type DayPlan = {
  context: string;
  intro: string;
  next: Suggestion;
  later: Suggestion[];
  projected: MacroTotals;
  gaps: MacroTotals;
  note: string;
  choices: PlanChoice[];
};

const TARGETS: MacroTotals = { calories: 1800, protein: 160, carbs: 155, fat: 60, fibre: 30 };
const ZERO: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };

const add = (a: MacroTotals, b: MacroTotals): MacroTotals => ({
  calories: a.calories + b.calories,
  protein: a.protein + b.protein,
  carbs: a.carbs + b.carbs,
  fat: a.fat + b.fat,
  fibre: a.fibre + b.fibre,
});

const round1 = (value: number) => Number(value.toFixed(1));

type Recipe = Omit<Suggestion, "macros">;

/**
 * A suggestion's macros are read back out of its own `logText` rather than written down beside
 * it. The card and the diary entry then agree by construction: hardcoding both let them drift
 * apart the moment a food's numbers changed, and the card is what Joe cooks from.
 */
function withMacros(recipe: Recipe): Suggestion {
  const parsed = parseFood(recipe.logText);
  if (parsed.unknown.length) {
    throw new Error(`Suggestion "${recipe.id}" names a food the parser cannot resolve: ${parsed.unknown.join(", ")}`);
  }
  const total = parsed.items.reduce((sum, item) => add(sum, item), ZERO);
  return {
    ...recipe,
    macros: {
      calories: Math.round(total.calories),
      protein: round1(total.protein),
      carbs: round1(total.carbs),
      fat: round1(total.fat),
      fibre: round1(total.fibre),
    },
  };
}

const MEAL_RECIPES: Recipe[] = [
  {
    id: "chicken-rice-bowl",
    kind: "meal",
    title: "Chicken rice bowl",
    items: ["200g cooked chicken thighs", "1 Veetee sticky rice pot", "250g broccoli", "150g peppers"],
    logText: "200g cooked chicken thighs, one Veetee sticky rice pot, 250g broccoli and 150g peppers",
  },
  {
    id: "lean-mince-pasta",
    kind: "meal",
    title: "Lean mince pasta",
    items: ["200g cooked 5% mince", "80g dry fusilli", "200g peppers"],
    logText: "200g cooked 5% mince, 80g dry pasta and 200g peppers",
  },
  {
    id: "lighter-mince-pasta",
    kind: "meal",
    title: "Lighter mince pasta",
    items: ["150g cooked 5% mince", "60g dry fusilli", "250g broccoli"],
    logText: "150g cooked 5% mince, 60g dry pasta and 250g broccoli",
  },
  {
    id: "chicken-pesto-pasta",
    kind: "meal",
    title: "Chicken pesto pasta",
    items: ["180g cooked chicken thighs", "80g dry fusilli", "15g pesto", "200g peppers"],
    logText: "180g cooked chicken thighs, 80g dry pasta, 15g pesto and 200g peppers",
  },
  {
    id: "steak-rice-broccoli",
    kind: "meal",
    title: "Steak, rice and broccoli",
    items: ["225g cooked sirloin steak", "1 Veetee sticky rice pot", "250g broccoli"],
    logText: "225g cooked steak, one Veetee sticky rice pot and 250g broccoli",
  },
  {
    id: "mince-rice-bowl",
    kind: "meal",
    title: "Mince rice bowl",
    items: ["200g cooked 5% mince", "1 Veetee sticky rice pot", "200g peppers", "75g avocado"],
    logText: "200g cooked 5% mince, one Veetee sticky rice pot, 200g peppers and 75g avocado",
  },
  {
    id: "steak-and-chips",
    kind: "meal",
    title: "Steak, chips and broccoli",
    items: ["180g cooked sirloin steak", "140g oven chips", "200g broccoli"],
    logText: "180g cooked steak, 140g oven chips and 200g broccoli",
  },
  {
    id: "salmon-rice-bowl",
    kind: "meal",
    title: "Salmon rice bowl",
    items: ["160g cooked salmon", "1 Veetee sticky rice pot", "250g broccoli"],
    logText: "160g cooked salmon, one Veetee sticky rice pot and 250g broccoli",
  },
  {
    id: "chicken-and-chips",
    kind: "meal",
    title: "Chicken, chips and peppers",
    items: ["180g cooked chicken thighs", "160g oven chips", "200g peppers"],
    logText: "180g cooked chicken thighs, 160g oven chips and 200g peppers",
  },
  {
    id: "steak-pesto-pasta",
    kind: "meal",
    title: "Steak pesto pasta",
    items: ["180g cooked sirloin steak", "60g dry fusilli", "10g pesto", "200g peppers"],
    logText: "180g cooked steak, 60g dry pasta, 10g pesto and 200g peppers",
  },
  {
    id: "salmon-pasta",
    kind: "meal",
    title: "Salmon pasta and broccoli",
    items: ["140g cooked salmon", "60g dry fusilli", "200g broccoli"],
    logText: "140g cooked salmon, 60g dry pasta and 200g broccoli",
  },
];

const SNACK_RECIPES: Recipe[] = [
  {
    id: "protein-yoghurt",
    kind: "snack",
    title: "High-protein yoghurt",
    items: ["200g high-protein yoghurt"],
    logText: "200g high protein yoghurt",
  },
  {
    id: "protein-bagel",
    kind: "snack",
    title: "Protein bagel",
    items: ["1 protein bagel"],
    logText: "one protein bagel",
  },
  {
    id: "bagel-peanut-butter",
    kind: "snack",
    title: "Bagel with peanut butter",
    items: ["1 protein bagel", "15g peanut butter"],
    logText: "one protein bagel and 15g peanut butter",
  },
  {
    id: "yoghurt-bagel",
    kind: "snack",
    title: "Yoghurt and a protein bagel",
    items: ["200g high-protein yoghurt", "1 protein bagel"],
    logText: "200g high protein yoghurt and one protein bagel",
  },
  {
    id: "yoghurt-veggie-cakes",
    kind: "snack",
    title: "Yoghurt with veggie cakes",
    items: ["200g high-protein yoghurt", "2 beetroot veggie cakes"],
    logText: "200g high protein yoghurt and two beetroot veggie cakes",
  },
  {
    id: "avocado-veggie-cakes",
    kind: "snack",
    title: "Avocado veggie cakes",
    items: ["100g avocado", "2 beetroot veggie cakes"],
    logText: "100g avocado and two beetroot veggie cakes",
  },
  {
    id: "broccoli-feta-side",
    kind: "snack",
    title: "Broccoli and feta side",
    items: ["250g broccoli", "30g feta"],
    logText: "250g broccoli and 30g feta",
  },
  {
    id: "four-veggie-cakes",
    kind: "snack",
    title: "Four beetroot veggie cakes",
    items: ["4 beetroot veggie cakes"],
    logText: "four beetroot veggie cakes",
  },
];

const MEALS: Suggestion[] = MEAL_RECIPES.map(withMacros);
const SNACKS: Suggestion[] = SNACK_RECIPES.map(withMacros);

const totalSuggestions = (items: Suggestion[]) => items.reduce((sum, item) => add(sum, item.macros), ZERO);

export const DAILY_TARGETS: MacroTotals = TARGETS;

/**
 * How far a projected end-of-day total sits from Joe's targets. Deficits and excesses are
 * weighted differently per macro (protein deficit hurts most, calorie/carb/fat excess next).
 * Exported so portion solving can minimise the same cost the meal recommender already uses —
 * one definition of "a good day", not two.
 */
export function scoreProjection(value: MacroTotals) {
  const deficit = (key: keyof MacroTotals) => Math.max(0, TARGETS[key] - value[key]);
  const excess = (key: keyof MacroTotals) => Math.max(0, value[key] - TARGETS[key]);
  return (
    (deficit("calories") / 100) ** 2 * 2.2 + (excess("calories") / 100) ** 2 * 5 +
    (deficit("protein") / 10) ** 2 * 20 + deficit("protein") * 20 + (excess("protein") / 10) ** 2 * 0.5 +
    (deficit("carbs") / 12) ** 2 * 2.2 + (excess("carbs") / 12) ** 2 * 4 +
    (deficit("fat") / 8) ** 2 * 1.5 + (excess("fat") / 8) ** 2 * 4 +
    (deficit("fibre") / 4) ** 2 * 6 + (excess("fibre") / 4) ** 2 * 0.15
  );
}

function snackGroups(minimum: number, maximum: number) {
  const groups: Suggestion[][] = [];
  function collect(start: number, selected: Suggestion[]) {
    if (selected.length >= minimum) groups.push(selected);
    if (selected.length === maximum) return;
    for (let index = start; index < SNACKS.length; index += 1) {
      collect(index + 1, [...selected, SNACKS[index]]);
    }
  }
  collect(0, []);
  return groups;
}

function candidatePlans(mealCount: number, needsMeal: boolean) {
  const plans: Suggestion[][] = [];
  if (mealCount === 0) {
    for (const next of MEALS) {
      for (const secondMeal of MEALS) {
        for (const topUps of snackGroups(0, 2)) plans.push([next, secondMeal, ...topUps]);
      }
    }
    return plans;
  }
  if (mealCount === 1 || needsMeal) {
    for (const next of MEALS) {
      for (const topUps of snackGroups(mealCount === 1 ? 1 : 0, mealCount === 1 ? 3 : 2)) plans.push([next, ...topUps]);
    }
    return plans;
  }
  for (const next of SNACKS) {
    plans.push([next]);
    for (const later of SNACKS) plans.push([next, later]);
  }
  return plans;
}

const timePeriod = (hour: number) => hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
const rounded = (value: number) => Math.max(0, Number(value.toFixed(1)));

function choiceFromPlan(consumed: MacroTotals, items: Suggestion[]): PlanChoice {
  const projected = add(consumed, totalSuggestions(items));
  const gaps = {
    calories: rounded(TARGETS.calories - projected.calories),
    protein: rounded(TARGETS.protein - projected.protein),
    carbs: rounded(TARGETS.carbs - projected.carbs),
    fat: rounded(TARGETS.fat - projected.fat),
    fibre: rounded(TARGETS.fibre - projected.fibre),
  };
  const note = gaps.fibre > 1
    ? `This is the closest sensible finish from your current foods. Fibre would still be about ${Math.round(gaps.fibre)}g short, so add vegetables or another high-fibre food instead of making one meal enormous.`
    : gaps.protein > 3
      ? `This plan keeps portions sensible but leaves about ${Math.round(gaps.protein)}g protein. Add a little more lean meat or yoghurt if hunger allows.`
      : "This combination brings the day close to your targets without relying on one oversized meal.";
  return { next: items[0], later: items.slice(1), projected, gaps, note };
}

export function recommendDay(consumed: MacroTotals, mealCount: number, hour: number): DayPlan {
  const initialGaps = {
    calories: Math.max(0, TARGETS.calories - consumed.calories),
    protein: Math.max(0, TARGETS.protein - consumed.protein),
    carbs: Math.max(0, TARGETS.carbs - consumed.carbs),
    fat: Math.max(0, TARGETS.fat - consumed.fat),
    fibre: Math.max(0, TARGETS.fibre - consumed.fibre),
  };
  const needsMeal = initialGaps.calories > 600 || initialGaps.protein > 45 || initialGaps.carbs > 55;
  const candidates = candidatePlans(mealCount, needsMeal);
  const ranked = candidates.map((candidate) => {
    const projected = add(consumed, totalSuggestions(candidate));
    const diversityPenalty = new Set(candidate.map((item) => item.id)).size === candidate.length ? 0 : 1.5;
    const score = scoreProjection(projected) + diversityPenalty + candidate.length * 0.05;
    return { items: candidate, score };
  }).sort((a, b) => a.score - b.score);
  const seenNext = new Set<string>();
  const choices = ranked
    .filter((candidate) => {
      const nextId = candidate.items[0]?.id;
      if (!nextId || seenNext.has(nextId)) return false;
      seenNext.add(nextId);
      return true;
    })
    .slice(0, 10)
    .map((candidate) => choiceFromPlan(consumed, candidate.items));
  const primary = choices[0] || choiceFromPlan(consumed, [SNACKS[0]]);
  const context = `${timePeriod(hour)} · ${mealCount} meal${mealCount === 1 ? "" : "s"} logged · ${Math.round(initialGaps.calories)} kcal left`;
  const intro = mealCount === 0
    ? "Start with a proper meal and keep the rest of the day balanced."
    : mealCount === 1
      ? "Have one more proper meal, then use small top-ups for what remains."
      : needsMeal
        ? "You have eaten twice, but the remaining gap is still meal-sized."
        : "Your main meals are covered. Use a small top-up rather than forcing another dinner.";
  return { context, intro, ...primary, choices };
}
