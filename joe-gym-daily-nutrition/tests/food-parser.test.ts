import { describe, expect, test } from "bun:test";

const parserModule = await import("../lib/food-parser").catch(() => ({}));
const parseFood = "parseFood" in parserModule
  ? parserModule.parseFood as (text: string) => { items: Array<{ id: string; display: string; calories: number; protein: number; fibre: number }> }
  : undefined;

describe("recommendation food logging", () => {
  test("parses a protein bagel and weighed peanut butter from a recommendation", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("one protein bagel and 15g peanut butter");

    expect(result.items.map((item) => item.id)).toEqual(["protein-bagel", "peanut-butter"]);
    expect(result.items.reduce((sum, item) => sum + item.calories, 0)).toBeCloseTo(285, 0);
    expect(result.items.reduce((sum, item) => sum + item.protein, 0)).toBeCloseTo(14.5, 1);
  });

  test("scales counted beetroot veggie cakes by the complete cake portion", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("four beetroot veggie cakes");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].display).toBe("4 cakes");
    expect(result.items[0].calories).toBeCloseTo(160, 0);
    expect(result.items[0].protein).toBeCloseTo(9.6, 1);
    expect(result.items[0].fibre).toBeCloseTo(2.4, 1);
  });
});
