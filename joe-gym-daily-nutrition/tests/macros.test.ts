import { describe, expect, test } from "bun:test";

import { EMPTY_DRAFT, asNumber, draftFromMacros, estimateCalories, readMacros } from "../lib/macros";

describe("reading numbers Joe typed", () => {
  test("takes the five figures as given", () => {
    const read = readMacros({ calories: "820", protein: "62", carbs: "45", fat: "38", fibre: "6" });
    expect(read).toEqual({ macros: { calories: 820, protein: 62, carbs: 45, fat: 38, fibre: 6 }, fibreUnknown: false });
  });

  test("tolerates the way a person types a number", () => {
    const read = readMacros({ calories: " 820 ", protein: "62.5", carbs: "45", fat: "38", fibre: "0" });
    expect(read?.macros.calories).toBe(820);
    expect(read?.macros.protein).toBe(62.5);
  });

  /**
   * Fibre is a hard 30g minimum, so a blank box counting as a measured zero would quietly eat
   * into it. It counts as zero — there is nothing else it could count as — but the meal is
   * marked so the app can say the figure is missing rather than low.
   */
  test("a blank fibre box is unknown, not a measured zero", () => {
    const read = readMacros({ ...EMPTY_DRAFT, calories: "820", protein: "62", carbs: "45", fat: "38" });
    expect(read).toEqual({ macros: { calories: 820, protein: 62, carbs: 45, fat: 38, fibre: 0 }, fibreUnknown: true });
  });

  test("a real zero is not unknown", () => {
    expect(readMacros({ calories: "820", protein: "62", carbs: "45", fat: "38", fibre: "0" })?.fibreUnknown).toBe(false);
  });

  /** A missing required figure is not a zero — a mealful of food is not 0g of protein. */
  test("refuses the whole entry when a required figure is missing", () => {
    expect(readMacros({ calories: "820", protein: "", carbs: "45", fat: "38", fibre: "6" })).toBeNull();
    expect(readMacros(EMPTY_DRAFT)).toBeNull();
  });

  test("refuses figures that are not numbers, or are negative", () => {
    expect(readMacros({ calories: "loads", protein: "62", carbs: "45", fat: "38", fibre: "6" })).toBeNull();
    expect(readMacros({ calories: "-20", protein: "62", carbs: "45", fat: "38", fibre: "6" })).toBeNull();
    expect(asNumber("")).toBeNull();
    expect(asNumber("0")).toBe(0);
  });
});

describe("offering a calorie figure", () => {
  /**
   * UK labels exclude fibre from carbohydrate and count it at about 2 kcal/g, hence the extra
   * term. This is only ever offered as a tap: Atwater factors approximate what a label says,
   * they do not reproduce it, and a number the app quietly filled in is the failure mode this
   * whole app is built against.
   */
  test("works it out from the other four", () => {
    expect(estimateCalories({ ...EMPTY_DRAFT, protein: "62", carbs: "45", fat: "38", fibre: "6" })).toBe(782);
  });

  test("treats a blank fibre box as nothing to add", () => {
    expect(estimateCalories({ ...EMPTY_DRAFT, protein: "10", carbs: "10", fat: "10" })).toBe(170);
  });

  test("offers nothing when it would be guessing", () => {
    expect(estimateCalories({ ...EMPTY_DRAFT, protein: "62", carbs: "45" })).toBeNull();
    expect(estimateCalories(EMPTY_DRAFT)).toBeNull();
  });
});

describe("filling the boxes from a meal already logged", () => {
  test("round-trips", () => {
    const macros = { calories: 670, protein: 51.2, carbs: 41.2, fat: 22, fibre: 0.8 };
    expect(readMacros(draftFromMacros(macros))?.macros).toEqual(macros);
  });

  test("trims the long tail off a computed total", () => {
    expect(draftFromMacros({ calories: 669.9999, protein: 51.24999, carbs: 41.2, fat: 22, fibre: 0.8 })).toEqual({
      calories: "670",
      protein: "51.2",
      carbs: "41.2",
      fat: "22",
      fibre: "0.8",
    });
  });

  test("leaves fibre blank when the meal never had a figure", () => {
    expect(draftFromMacros({ calories: 820, protein: 62, carbs: 45, fat: 38, fibre: 0 }, true).fibre).toBe("");
  });
});
