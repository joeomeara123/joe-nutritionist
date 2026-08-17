import { describe, expect, test } from "bun:test";

const parserModule = await import("../lib/food-parser").catch(() => ({}));
type ParseResult = {
  items: Array<{ id: string; display: string; grams: number; calories: number; protein: number; fat: number; fibre: number }>;
  unknown: string[];
};
const parseFood = "parseFood" in parserModule
  ? parserModule.parseFood as (text: string) => ParseResult
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

describe("unrecognised foods are reported, never silently dropped", () => {
  test("reports an unknown item even when another item in the same line matched", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("200g cooked chicken thighs and 40g quinoa");

    expect(result.items.map((item) => item.id)).toEqual(["chicken-thigh"]);
    expect(result.unknown.join(" ")).toContain("quinoa");
  });

  test("still reports the whole line when nothing matched", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("a bowl of quinoa");

    expect(result.items).toHaveLength(0);
    expect(result.unknown.join(" ")).toContain("quinoa");
  });
});

describe("cooking oil is a first-class food", () => {
  test("prices weighed olive oil as pure fat", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("4g olive oil");

    expect(result.items.map((item) => item.id)).toEqual(["olive-oil"]);
    expect(result.items[0].calories).toBeCloseTo(35.4, 1);
    expect(result.items[0].fat).toBeCloseTo(4, 1);
    expect(result.unknown).toHaveLength(0);
  });

  test("counts oil alongside the meat it is cooked with", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("308g cooked chicken thighs and 4g olive oil");

    expect(result.items.map((item) => item.id)).toEqual(["chicken-thigh", "olive-oil"]);
    expect(result.items.reduce((sum, item) => sum + item.fat, 0)).toBeCloseTo(27.4, 1);
  });
});

describe("raw weights convert to the cooked basis instead of failing quietly", () => {
  test("converts a raw chicken thigh weight using the cooking yield", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("428g raw chicken thighs");

    expect(result.items).toHaveLength(1);
    // 428g raw x 0.72 yield = 308.16g cooked, priced on the cooked basis.
    expect(result.items[0].grams).toBeCloseTo(308.2, 1);
    expect(result.items[0].calories).toBeCloseTo(517.7, 0);
    expect(result.items[0].protein).toBeCloseTo(76.4, 1);
    expect(result.items[0].fat).toBeCloseTo(23.4, 1);
  });

  test("does not fall back to a single portion when 'raw' precedes the food", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("428g raw chicken thighs");

    // The regression: 'raw' broke the gram match, silently logging one 64g thigh.
    expect(result.items[0].grams).toBeGreaterThan(200);
  });

  test("leaves an explicitly cooked weight unconverted", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("308g cooked chicken thighs");

    expect(result.items[0].grams).toBeCloseTo(308, 0);
  });
});
