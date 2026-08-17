import { describe, expect, test } from "bun:test";

import { DAILY_TARGETS } from "../lib/recommendations";
import { fitPortion, lookupFood, priceMeal, suggestMeals, type DayState } from "../lib/nutrition-tools";

const ZERO = { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };

/** Joe's seeded Monday lunch: 530 kcal / 50.8g protein logged, so ~1,270 kcal left. */
const AFTER_LUNCH: DayState = {
  consumed: { calories: 530, protein: 50.8, carbs: 41.7, fat: 17.4, fibre: 0.3 },
  mealCount: 1,
  hour: 18,
};

const NEARLY_DONE: DayState = {
  consumed: { calories: 1500, protein: 140, carbs: 130, fat: 45, fibre: 25 },
  mealCount: 3,
  hour: 20,
};

describe("lookupFood", () => {
  test("resolves a short name to the stored food and its basis", () => {
    const food = lookupFood("rice");
    expect(food?.id).toBe("sticky-rice");
    expect(food?.basis).toBe("portion");
  });

  test("resolves cooking oil, which used to be absent entirely", () => {
    expect(lookupFood("olive oil")?.id).toBe("olive-oil");
    expect(lookupFood("oil")?.id).toBe("olive-oil");
  });

  test("returns null rather than guessing at an unstocked food", () => {
    expect(lookupFood("quinoa")).toBeNull();
  });
});

describe("priceMeal", () => {
  test("totals a meal and reports where the day lands after it", () => {
    const result = priceMeal([{ food: "chicken thighs", grams: 200 }, { food: "sticky rice", grams: 130 }], AFTER_LUNCH);

    expect(result.total.calories).toBeCloseTo(534, 0);
    expect(result.projected.calories).toBeCloseTo(1064, 0);
    expect(result.remaining.calories).toBeCloseTo(736, 0);
    expect(result.unknown).toHaveLength(0);
  });

  test("converts a raw weighing rather than pricing it as cooked", () => {
    const raw = priceMeal([{ food: "chicken thighs", grams: 428, raw: true }], AFTER_LUNCH);
    const cooked = priceMeal([{ food: "chicken thighs", grams: 428 }], AFTER_LUNCH);

    expect(raw.total.calories).toBeLessThan(cooked.total.calories);
    expect(raw.total.calories).toBeCloseTo(517.7, 0);
    expect(raw.items[0].fromRawGrams).toBe(428);
  });

  test("names foods it does not stock instead of dropping them", () => {
    const result = priceMeal([{ food: "chicken thighs", grams: 200 }, { food: "quinoa", grams: 60 }], AFTER_LUNCH);

    expect(result.items).toHaveLength(1);
    expect(result.unknown).toEqual(["quinoa"]);
  });
});

describe("fitPortion — solving for the missing quantity", () => {
  test("sizes rice to fill the day after three chicken thighs", () => {
    const result = fitPortion({
      day: AFTER_LUNCH,
      fixed: [{ food: "chicken thighs", grams: 192 }],
      variable: "sticky rice",
    });

    expect(result.grams).toBeGreaterThan(0);
    // The whole point: the day must land at or under target, not blow past it.
    expect(result.projected.calories).toBeLessThanOrEqual(DAILY_TARGETS.calories);
    expect(result.projected.carbs).toBeLessThanOrEqual(DAILY_TARGETS.carbs);
  });

  test("gives a bigger portion when more of the day is left", () => {
    const roomy = fitPortion({ day: AFTER_LUNCH, fixed: [{ food: "chicken thighs", grams: 192 }], variable: "sticky rice" });
    const tight = fitPortion({ day: NEARLY_DONE, fixed: [{ food: "chicken thighs", grams: 192 }], variable: "sticky rice" });

    expect(roomy.grams).toBeGreaterThan(tight.grams);
  });

  test("answers the oil question: headroom shrinks as the fat budget is used", () => {
    const lowFat = fitPortion({
      day: { consumed: { ...ZERO, calories: 400, protein: 40, fat: 5 }, mealCount: 1, hour: 18 },
      fixed: [{ food: "chicken thighs", grams: 308 }],
      variable: "olive oil",
    });
    const highFat = fitPortion({
      day: { consumed: { ...ZERO, calories: 900, protein: 60, fat: 30 }, mealCount: 2, hour: 19 },
      fixed: [{ food: "chicken thighs", grams: 308 }],
      variable: "olive oil",
    });

    expect(highFat.grams).toBeLessThan(lowFat.grams);
    expect(highFat.projected.fat).toBeLessThanOrEqual(DAILY_TARGETS.fat + 1);
  });

  test("never proposes a portion that pushes the day over its calorie target", () => {
    const result = fitPortion({ day: NEARLY_DONE, fixed: [], variable: "dry pasta" });
    expect(result.projected.calories).toBeLessThanOrEqual(DAILY_TARGETS.calories);
  });

  test("reports the unknown food instead of silently solving for nothing", () => {
    expect(() => fitPortion({ day: AFTER_LUNCH, fixed: [], variable: "quinoa" })).toThrow(/quinoa/i);
  });
});

describe("suggestMeals", () => {
  test("ranks buildable meals for what is left of the day", () => {
    const result = suggestMeals(AFTER_LUNCH);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("title");
    expect(result[0].macros.calories).toBeGreaterThan(0);
  });

  test("filters to meals containing a craving", () => {
    const result = suggestMeals(AFTER_LUNCH, "pasta");
    expect(result.length).toBeGreaterThan(0);
    for (const meal of result) {
      expect(`${meal.title} ${meal.items.join(" ")}`.toLowerCase()).toContain("pasta");
    }
  });
});
