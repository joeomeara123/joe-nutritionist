import { describe, expect, test } from "bun:test";

const parserModule = await import("../lib/food-parser").catch(() => ({}));
type ParseResult = {
  items: Array<{ id: string; display: string; grams: number; calories: number; protein: number; carbs: number; fat: number; fibre: number; weighedGrams?: number; weighedAs?: string; assumed?: "quantity" | "portionSize" }>;
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
    expect(result.items.reduce((sum, item) => sum + item.calories, 0)).toBeCloseTo(287.6, 0);
    expect(result.items.reduce((sum, item) => sum + item.protein, 0)).toBeCloseTo(14.3, 1);
  });

  test("scales counted beetroot veggie cakes by the complete cake portion", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("four beetroot veggie cakes");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].display).toBe("4 cakes");
    expect(result.items[0].calories).toBeCloseTo(159.2, 0);
    expect(result.items[0].protein).toBeCloseTo(9.2, 1);
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

  test("treats 'uncooked' as raw, not as an unqualified weight", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("428g uncooked chicken thighs");

    // "uncooked" contains "cooked", so a naive alternation matched neither and the
    // whole gram match failed, falling back to one 64g thigh.
    expect(result.items[0].grams).toBeCloseTo(308.2, 1);
  });
});

describe("cooked and dry are opposite corrections", () => {
  test("converts a cooked pasta weight back to the dry basis it is stored on", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("225g of cooked pasta");

    // Pasta is stored dry and Joe's own note gives the ratio: 100g dry makes 225g cooked.
    expect(result.items[0].grams).toBeCloseTo(100, 1);
    expect(result.items[0].calories).toBeCloseTo(351, 0);
  });

  test("leaves a dry pasta weight alone", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    expect(parseFood("100g of uncooked pasta").items[0].grams).toBeCloseTo(100, 1);
    expect(parseFood("100g dry pasta").items[0].grams).toBeCloseTo(100, 1);
  });

  test("corrects meat and pasta in opposite directions from the same word", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    // "cooked" is a no-op on meat (already the stored basis) and a big cut on pasta.
    expect(parseFood("200g cooked chicken thighs").items[0].grams).toBeCloseTo(200, 1);
    expect(parseFood("200g cooked pasta").items[0].grams).toBeCloseTo(88.9, 1);
    // "uncooked" is the reverse pair.
    expect(parseFood("200g uncooked chicken thighs").items[0].grams).toBeCloseTo(144, 1);
    expect(parseFood("200g uncooked pasta").items[0].grams).toBeCloseTo(200, 1);
  });
});

describe("digits count as counts", () => {
  test("multiplies a numeral by the portion, as the number words already did", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const digits = parseFood("3 chicken thighs");
    const words = parseFood("three chicken thighs");

    expect(digits.items[0].grams).toBeCloseTo(192, 0);
    expect(digits.items[0].grams).toBeCloseTo(words.items[0].grams, 1);
  });
});

describe("a weight in brackets is still a weight", () => {
  test("reads the bracketed weight after the food and prefers it over the count", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("3 chicken thighs (392g uncooked)");

    // The stated weight wins: 392g raw x 0.72 = 282.24g cooked, not 3 x 64g.
    expect(result.items).toHaveLength(1);
    expect(result.items[0].grams).toBeCloseTo(282.2, 1);
    expect(result.items[0].protein).toBeCloseTo(70, 0);
    expect(result.unknown).toHaveLength(0);
  });
});

describe("a bracketed weight before the food", () => {
  test("reads '3 uncooked (392g) chicken thighs' as the stated raw weight", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("I just ate 3 uncooked (392g) chicken thighs");

    expect(result.items[0].grams).toBeCloseTo(282.2, 1);
    expect(result.unknown).toHaveLength(0);
  });
});

describe("a weight belongs to its own food", () => {
  test("does not take the next clause's weight across a comma", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("chicken thighs, 100g pasta");
    const chicken = result.items.find((item) => item.id === "chicken-thigh");

    // The trap: scanning forward past the comma made the chicken 100g — the pasta's weight.
    expect(chicken?.grams).toBeCloseTo(64, 1);
    expect(chicken?.assumed).toBe("quantity");
    expect(result.items.find((item) => item.id === "pasta")?.grams).toBeCloseTo(100, 1);
  });
});

describe("spoons are a quantity", () => {
  test("reads a spoon measure given after the food in brackets", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("some pesto (2 teaspoons)");

    expect(result.items[0].grams).toBeCloseTo(10, 1);
    expect(result.items[0].assumed).toBeUndefined();
  });

  test("prices teaspoons of pesto instead of defaulting to 100g", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("2 teaspoons of pesto");

    expect(result.items[0].grams).toBeCloseTo(10, 1);
    expect(result.items[0].fat).toBeCloseTo(4.5, 1);
  });

  test("uses the food's own tablespoon weight where it has one", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("2 tbsp olive oil");

    // Olive oil stores a 13.5g tbsp, so this must not use a generic 15g.
    expect(result.items[0].grams).toBeCloseTo(27, 1);
  });
});

describe("an unstated quantity is a serving, not 100g", () => {
  test("gives bare pesto a tablespoon rather than a third of a jar", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("chicken thighs with pesto");
    const pesto = result.items.find((item) => item.id === "pesto");

    expect(pesto?.grams).toBeCloseTo(15, 1);
    expect(pesto?.assumed).toBe("quantity");
  });

  test("does not flag a quantity Joe actually stated", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    expect(parseFood("30g pesto").items[0].assumed).toBeUndefined();
    expect(parseFood("2 tsp pesto").items[0].assumed).toBeUndefined();
    // A count is stated, but what one thigh weighs is not — that is a different assumption.
    expect(parseFood("three chicken thighs").items[0].assumed).toBe("portionSize");
  });
});

describe("the second sentence Joe typed, with the weight and the spoons in brackets", () => {
  const line = "I just ate 3 uncooked (392g) chicken thighs, 100g of uncooked pasta and some pesto (2 teaspoons)";

  test("reads all three quantities", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood(line);

    expect(result.items.map((item) => item.id)).toEqual(["chicken-thigh", "pasta", "pesto"]);
    expect(result.items[0].grams).toBeCloseTo(282.2, 1);
    expect(result.items[1].grams).toBeCloseTo(100, 1);
    expect(result.items[2].grams).toBeCloseTo(10, 1);
    expect(result.items.some((item) => item.assumed)).toBe(false);
    expect(result.unknown).toHaveLength(0);
  });

  test("totals the same as the same meal written without brackets", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const bracketed = parseFood(line).items;
    const plain = parseFood("392g raw chicken thighs, 100g pasta and 10g pesto").items;
    const kcal = (items: ParseResult["items"]) => items.reduce((sum, item) => sum + item.calories, 0);

    expect(kcal(bracketed)).toBeCloseTo(kcal(plain), 0);
    expect(kcal(bracketed)).toBeCloseTo(870.3, 0);
  });
});

describe("the whole sentence Joe actually typed", () => {
  const line = "I just had 3 chicken thighs (392g uncooked) and 100g of uncooked pasta (225 cooked) and 2 teaspoons of pesto";

  test("reads every quantity he gave", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood(line);

    expect(result.items.map((item) => item.id)).toEqual(["chicken-thigh", "pasta", "pesto"]);
    expect(result.items[0].grams).toBeCloseTo(282.2, 1); // 392g raw, converted
    expect(result.items[1].grams).toBeCloseTo(100, 1); // dry pasta is already the stored basis
    expect(result.items[2].grams).toBeCloseTo(10, 1); // 2 tsp
    expect(result.unknown).toHaveLength(0);
  });

  test("totals the meal correctly", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const items = parseFood(line).items;
    const sum = (key: "calories" | "protein" | "fat" | "fibre") => items.reduce((total, item) => total + item[key], 0);

    // Was 922 kcal / 32.6g protein / 52.5g fat: one 64g thigh and 100g of pesto.
    expect(sum("calories")).toBeCloseTo(870.3, 0);
    expect(sum("protein")).toBeCloseTo(84.4, 1);
    expect(sum("fat")).toBeCloseTo(27.5, 1);
    expect(sum("fibre")).toBeCloseTo(3.1, 1);
  });
});

describe("a counted portion is a count, not a weight", () => {
  test("flags the per-item weight it had to assume", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    const result = parseFood("3 chicken thighs");

    // 192g is 3 x an assumed 64g thigh. Sainsbury's pack says fillet sizes vary and gives no
    // serving count, so there is nothing to source it from — it must not read as measured.
    expect(result.items[0].grams).toBeCloseTo(192, 0);
    expect(result.items[0].assumed).toBe("portionSize");
  });

  test("does not flag a counted pack item, whose portion is the unit itself", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    // A Veetee pot is a pot and a bagel is a bagel; only variable-size foods carry the flag.
    expect(parseFood("one Veetee sticky rice pot").items[0].assumed).toBeUndefined();
    expect(parseFood("four beetroot veggie cakes").items[0].assumed).toBeUndefined();
  });

  test("a stated weight overrides the assumption entirely", () => {
    expect(typeof parseFood).toBe("function");
    if (!parseFood) return;

    expect(parseFood("3 chicken thighs (392g uncooked)").items[0].assumed).toBeUndefined();
  });
});
