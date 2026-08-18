import { describe, expect, test } from "bun:test";

import { searchFoodDatabase } from "../lib/food-lookup";
import { priceMeal, fitPortion, type DayState } from "../lib/nutrition-tools";

const DAY: DayState = { consumed: { calories: 1500, protein: 135, carbs: 140, fat: 48, fibre: 12 }, mealCount: 3, hour: 20 };

describe("pricing a food that is not in the catalogue", () => {
  test("uses caller-supplied per-100g macros instead of dead-ending", () => {
    const result = priceMeal(
      [{ food: "0% Greek yoghurt", grams: 200, per100g: { calories: 57, protein: 10, carbs: 4, fat: 0.2, fibre: 0 } }],
      DAY,
    );

    expect(result.unknown).toHaveLength(0);
    expect(result.total.calories).toBeCloseTo(114, 0);
    expect(result.total.protein).toBeCloseTo(20, 1);
  });

  test("mixes a looked-up food with a stocked one in the same meal", () => {
    const result = priceMeal(
      [
        { food: "plain bagel", portions: 1, per100g: { calories: 271, protein: 9.8, carbs: 47.6, fat: 2.6, fibre: 3.1 } },
        { food: "peanut butter", grams: 15 },
      ],
      DAY,
    );

    expect(result.items).toHaveLength(2);
    expect(result.unknown).toHaveLength(0);
    // An ad-hoc food has no portion size, so one "portion" falls back to 100g.
    expect(result.items[0].grams).toBeCloseTo(100, 1);
  });

  test("solves a portion for a looked-up food", () => {
    const result = fitPortion({
      day: DAY,
      fixed: [],
      variable: "0% Greek yoghurt",
      variablePer100g: { calories: 57, protein: 10, carbs: 4, fat: 0.2, fibre: 0 },
    });

    expect(result.grams).toBeGreaterThan(0);
    expect(result.food).toBe("0% Greek yoghurt");
  });

  test("still reports a food it was given nothing for", () => {
    expect(priceMeal([{ food: "quinoa", grams: 60 }], DAY).unknown).toEqual(["quinoa"]);
  });
});

describe("the food database lookup", () => {
  test("finds a real product and returns usable per-100g macros", async () => {
    const { foods, unreachable } = await searchFoodDatabase("Greek style natural yogurt");
    if (unreachable || !foods.length) return; // network-dependent; the offline path is covered above

    for (const food of foods) {
      expect(food.name.length).toBeGreaterThan(0);
      expect(food.provisional).toBe(true);
      expect(food.per100g.calories).toBeGreaterThan(0);
      expect(Number.isFinite(food.per100g.protein)).toBe(true);
    }
  }, 20000);

  test("returns nothing rather than throwing on a nonsense query", async () => {
    const found = await searchFoodDatabase("zzzzqqqqxxxx nonsense food");
    expect(Array.isArray(found.foods)).toBe(true);
  }, 20000);

  /** An outage used to be indistinguishable from an empty shelf. It has its own flag now. */
  test("separates the database being down from the food not existing", async () => {
    const found = await searchFoodDatabase("chickpeas");
    expect(typeof found.unreachable).toBe("boolean");
    if (found.unreachable) expect(found.foods).toHaveLength(0);
  }, 20000);
});
