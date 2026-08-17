import { describe, expect, test } from "bun:test";

import { FOODS, parseFood } from "../lib/food-parser";
import { recommendDay } from "../lib/recommendations";

/**
 * Foods Sainsbury's stocks but publishes no nutrition table for: the Veetee Heat & Eat pots and
 * McCain's Gastro chips. Their macros are estimates carried over from the original build.
 *
 * This list is asserted exactly, and it has already earned that. A first pass wrongly put the
 * protein bagel, feta and olive oil in here — an empty `details_html` from the Sainsbury's API
 * turned out to be transient, and one product published its numbers only per bagel. Re-check
 * before concluding a food cannot be sourced; do not fill one in from a similar product.
 */
const UNSOURCED = ["sticky-rice", "jasmine-rice", "chips"];

describe("every food says where its numbers came from", () => {
  test("only the known exceptions lack a source", () => {
    const missing = FOODS.filter((food) => !food.source).map((food) => food.id);
    expect(missing.sort()).toEqual([...UNSOURCED].sort());
  });

  test("each source names a real Sainsbury's product page and its basis", () => {
    for (const food of FOODS) {
      if (!food.source) continue;
      expect(food.source.url).toMatch(/^https:\/\/www\.sainsburys\.co\.uk\/gol-ui\/product\/[a-z0-9-]+$/);
      expect(food.source.product.length).toBeGreaterThan(8);
      // The basis matters as much as the number: "per 100g" of a raw pack and of a
      // cooked-as-instructed one are different quantities.
      expect(food.source.basis).toMatch(/per 100g/i);
    }
  });

  test("a cook ratio points the right way for the state its food is stored in", () => {
    for (const food of FOODS) {
      if (food.cookedRatio === undefined) continue;
      expect(food.weighedAs).toBeDefined();
      expect(food.cookedRatio).toBeGreaterThan(0);
      // Meat loses water and pasta gains it, so the ratio sits either side of 1 — but a food
      // stored cooked can only lose, and one stored dry can only gain.
      if (food.weighedAs === "cooked") expect(food.cookedRatio).toBeLessThan(1);
      if (food.weighedAs === "uncooked") expect(food.cookedRatio).toBeGreaterThan(1);
    }
  });
});

describe("suggestions and the diary agree", () => {
  const plan = recommendDay({ calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }, 0, 12);
  const suggestions = [plan.next, ...plan.later, ...plan.choices.flatMap((choice) => [choice.next, ...choice.later])];

  test("every suggested meal is fully parseable", () => {
    expect(suggestions.length).toBeGreaterThan(0);
    for (const suggestion of suggestions) {
      const parsed = parseFood(suggestion.logText);
      expect({ id: suggestion.id, unknown: parsed.unknown }).toEqual({ id: suggestion.id, unknown: [] });
      expect(parsed.items.length).toBeGreaterThan(0);
    }
  });

  test("the macros on the card are the macros logging it produces", () => {
    for (const suggestion of suggestions) {
      const items = parseFood(suggestion.logText).items;
      const logged = items.reduce((sum, item) => sum + item.calories, 0);
      // Not a tautology worth skipping: it is the property that broke when the two were
      // written down separately, and it is what Joe cooks from.
      expect(Math.abs(suggestion.macros.calories - logged)).toBeLessThan(1);
    }
  });

  test("no suggestion silently relies on an assumed quantity", () => {
    for (const suggestion of suggestions) {
      const assumed = parseFood(suggestion.logText).items.filter((item) => item.assumed);
      expect({ id: suggestion.id, assumed: assumed.map((item) => item.id) }).toEqual({ id: suggestion.id, assumed: [] });
    }
  });
});
