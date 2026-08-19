import { describe, expect, test } from "bun:test";

const parserModule = await import("../lib/food-parser").catch(() => ({}));
type ParseResult = {
  items: Array<{ id: string; display: string; grams: number; calories: number; protein: number; carbs: number; fat: number; fibre: number; weighedGrams?: number; weighedAs?: string; assumed?: "quantity" | "portionSize" }>;
  unknown: string[];
};
const parseFood = (parserModule as { parseFood?: (text: string) => ParseResult }).parseFood
  ?? ((): ParseResult => { throw new Error("parseFood is not exported"); });
type StoredFood = { id: string; name: string; aliases: string[]; basis: "100g" | "portion" } & Record<string, unknown>;
const suggestFoods = (parserModule as { suggestFoods?: (fragment: string, extra?: StoredFood[]) => string[] }).suggestFoods
  ?? ((): string[] => { throw new Error("suggestFoods is not exported"); });

describe("recommendation food logging", () => {
  test("parses a protein bagel and weighed peanut butter from a recommendation", () => {
    expect(typeof parseFood).toBe("function");

    const result = parseFood("one protein bagel and 15g peanut butter");

    expect(result.items.map((item) => item.id)).toEqual(["protein-bagel", "peanut-butter"]);
    expect(result.items.reduce((sum, item) => sum + item.calories, 0)).toBeCloseTo(295.6, 0);
    expect(result.items.reduce((sum, item) => sum + item.protein, 0)).toBeCloseTo(14.3, 1);
  });

  test("scales counted beetroot veggie cakes by the complete cake portion", () => {
    expect(typeof parseFood).toBe("function");

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

    const result = parseFood("200g cooked chicken thighs and 40g quinoa");

    expect(result.items.map((item) => item.id)).toEqual(["chicken-thigh"]);
    expect(result.unknown.join(" ")).toContain("quinoa");
  });

  test("still reports the whole line when nothing matched", () => {
    expect(typeof parseFood).toBe("function");

    const result = parseFood("a bowl of quinoa");

    expect(result.items).toHaveLength(0);
    expect(result.unknown.join(" ")).toContain("quinoa");
  });
});

describe("cooking oil is a first-class food", () => {
  test("prices weighed olive oil as pure fat", () => {
    expect(typeof parseFood).toBe("function");

    const result = parseFood("4g olive oil");

    expect(result.items.map((item) => item.id)).toEqual(["olive-oil"]);
    expect(result.items[0].calories).toBeCloseTo(35.9, 1);
    expect(result.items[0].fat).toBeCloseTo(4, 1);
    expect(result.unknown).toHaveLength(0);
  });

  test("counts oil alongside the meat it is cooked with", () => {
    expect(typeof parseFood).toBe("function");

    const result = parseFood("308g cooked chicken thighs and 4g olive oil");

    expect(result.items.map((item) => item.id)).toEqual(["chicken-thigh", "olive-oil"]);
    expect(result.items.reduce((sum, item) => sum + item.fat, 0)).toBeCloseTo(27.4, 1);
  });
});

describe("raw weights convert to the cooked basis instead of failing quietly", () => {
  test("converts a raw chicken thigh weight using the cooking yield", () => {
    expect(typeof parseFood).toBe("function");

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

    const result = parseFood("428g raw chicken thighs");

    // The regression: 'raw' broke the gram match, silently logging one 64g thigh.
    expect(result.items[0].grams).toBeGreaterThan(200);
  });

  test("leaves an explicitly cooked weight unconverted", () => {
    expect(typeof parseFood).toBe("function");

    const result = parseFood("308g cooked chicken thighs");

    expect(result.items[0].grams).toBeCloseTo(308, 0);
  });

  test("treats 'uncooked' as raw, not as an unqualified weight", () => {
    expect(typeof parseFood).toBe("function");

    const result = parseFood("428g uncooked chicken thighs");

    // "uncooked" contains "cooked", so a naive alternation matched neither and the
    // whole gram match failed, falling back to one 64g thigh.
    expect(result.items[0].grams).toBeCloseTo(308.2, 1);
  });
});

describe("cooked and uncooked corrections run both ways", () => {
  test("leaves a cooked pasta weight alone, since the label itself is cooked", () => {
    expect(typeof parseFood).toBe("function");

    const result = parseFood("225g of cooked pasta");

    expect(result.items[0].grams).toBeCloseTo(225, 1);
    expect(result.items[0].calories).toBeCloseTo(369, 0);
  });

  test("scales a dry pasta weight up to the cooked basis it is stored on", () => {
    expect(typeof parseFood).toBe("function");

    // Joe's own ratio: 100g dry makes 225g cooked.
    expect(parseFood("100g of uncooked pasta").items[0].grams).toBeCloseTo(225, 1);
    expect(parseFood("100g dry pasta").items[0].grams).toBeCloseTo(225, 1);
  });

  test("corrects meat and pasta in opposite directions from the same word", () => {
    expect(typeof parseFood).toBe("function");

    // Both are stored cooked, so "cooked" is a no-op on each.
    expect(parseFood("200g cooked chicken thighs").items[0].grams).toBeCloseTo(200, 1);
    expect(parseFood("200g cooked pasta").items[0].grams).toBeCloseTo(200, 1);
    // "uncooked" shrinks the meat and grows the pasta.
    expect(parseFood("200g uncooked chicken thighs").items[0].grams).toBeCloseTo(144, 1);
    expect(parseFood("200g uncooked pasta").items[0].grams).toBeCloseTo(450, 1);
  });

  test("takes an unqualified weight as uncooked, the way Joe weighs things", () => {
    expect(typeof parseFood).toBe("function");

    // He weighs out of the packet. Reading "100g pasta" as 100g cooked would log a third of
    // what he is about to eat, so the default matters more than it looks.
    const pasta = parseFood("100g pasta").items[0];
    expect(pasta.grams).toBeCloseTo(225, 1);
    expect(pasta.weighedGrams).toBe(100);
    expect(pasta.weighedAs).toBe("uncooked");
  });
});

describe("digits count as counts", () => {
  test("multiplies a numeral by the portion, as the number words already did", () => {
    expect(typeof parseFood).toBe("function");

    const digits = parseFood("3 chicken thighs");
    const words = parseFood("three chicken thighs");

    expect(digits.items[0].grams).toBeCloseTo(192, 0);
    expect(digits.items[0].grams).toBeCloseTo(words.items[0].grams, 1);
  });
});

describe("a weight in brackets is still a weight", () => {
  test("reads the bracketed weight after the food and prefers it over the count", () => {
    expect(typeof parseFood).toBe("function");

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

    const result = parseFood("I just ate 3 uncooked (392g) chicken thighs");

    expect(result.items[0].grams).toBeCloseTo(282.2, 1);
    expect(result.unknown).toHaveLength(0);
  });
});

describe("a weight belongs to its own food", () => {
  test("does not take the next clause's weight across a comma", () => {
    expect(typeof parseFood).toBe("function");

    const result = parseFood("chicken thighs, 100g pasta");
    const chicken = result.items.find((item) => item.id === "chicken-thigh");

    // The trap: scanning forward past the comma made the chicken 100g — the pasta's weight.
    expect(chicken?.grams).toBeCloseTo(64, 1);
    expect(chicken?.assumed).toBe("quantity");
    expect(result.items.find((item) => item.id === "pasta")?.grams).toBeCloseTo(225, 1);
  });
});

describe("spoons are a quantity", () => {
  test("reads a spoon measure given after the food in brackets", () => {
    expect(typeof parseFood).toBe("function");

    const result = parseFood("some pesto (2 teaspoons)");

    expect(result.items[0].grams).toBeCloseTo(10, 1);
    expect(result.items[0].assumed).toBeUndefined();
  });

  test("prices teaspoons of pesto instead of defaulting to 100g", () => {
    expect(typeof parseFood).toBe("function");

    const result = parseFood("2 teaspoons of pesto");

    expect(result.items[0].grams).toBeCloseTo(10, 1);
    expect(result.items[0].fat).toBeCloseTo(2.8, 1);
  });

  test("uses the food's own tablespoon weight where it has one", () => {
    expect(typeof parseFood).toBe("function");

    const result = parseFood("2 tbsp olive oil");

    // Olive oil's label gives a 13.7g tbsp, so this must not use the generic 15g.
    expect(result.items[0].grams).toBeCloseTo(27.4, 1);
  });
});

describe("an unstated quantity is a serving, not 100g", () => {
  test("gives bare pesto a tablespoon rather than a third of a jar", () => {
    expect(typeof parseFood).toBe("function");

    const result = parseFood("chicken thighs with pesto");
    const pesto = result.items.find((item) => item.id === "pesto");

    expect(pesto?.grams).toBeCloseTo(15, 1);
    expect(pesto?.assumed).toBe("quantity");
  });

  test("does not flag a quantity Joe actually stated", () => {
    expect(typeof parseFood).toBe("function");

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

    const result = parseFood(line);

    expect(result.items.map((item) => item.id)).toEqual(["chicken-thigh", "pasta", "pesto"]);
    expect(result.items[0].grams).toBeCloseTo(282.2, 1);
    expect(result.items[1].grams).toBeCloseTo(225, 1);
    expect(result.items[2].grams).toBeCloseTo(10, 1);
    expect(result.items.some((item) => item.assumed)).toBe(false);
    expect(result.unknown).toHaveLength(0);
  });

  test("totals the same as the same meal written without brackets", () => {
    expect(typeof parseFood).toBe("function");

    const bracketed = parseFood(line).items;
    const plain = parseFood("392g raw chicken thighs, 100g uncooked pasta and 10g pesto").items;
    const kcal = (items: ParseResult["items"]) => items.reduce((sum, item) => sum + item.calories, 0);

    expect(kcal(bracketed)).toBeCloseTo(kcal(plain), 0);
    expect(kcal(bracketed)).toBeCloseTo(874.4, 0);
  });
});

describe("the whole sentence Joe actually typed", () => {
  const line = "I just had 3 chicken thighs (392g uncooked) and 100g of uncooked pasta (225 cooked) and 2 teaspoons of pesto";

  test("reads every quantity he gave", () => {
    expect(typeof parseFood).toBe("function");

    const result = parseFood(line);

    expect(result.items.map((item) => item.id)).toEqual(["chicken-thigh", "pasta", "pesto"]);
    expect(result.items[0].grams).toBeCloseTo(282.2, 1); // 392g raw, converted
    expect(result.items[1].grams).toBeCloseTo(225, 1); // 100g dry becomes 225g cooked
    expect(result.items[2].grams).toBeCloseTo(10, 1); // 2 tsp
    expect(result.unknown).toHaveLength(0);
  });

  test("totals the meal correctly", () => {
    expect(typeof parseFood).toBe("function");

    const items = parseFood(line).items;
    const sum = (key: "calories" | "protein" | "fat" | "fibre") => items.reduce((total, item) => total + item[key], 0);

    // Was 922 kcal / 32.6g protein / 52.5g fat: one 64g thigh and 100g of pesto.
    expect(sum("calories")).toBeCloseTo(874.4, 0);
    expect(sum("protein")).toBeCloseTo(82.8, 1);
    expect(sum("fat")).toBeCloseTo(25.9, 1);
    expect(sum("fibre")).toBeCloseTo(3.7, 1);
  });
});

describe("a counted portion is a count, not a weight", () => {
  test("flags the per-item weight it had to assume", () => {
    expect(typeof parseFood).toBe("function");

    const result = parseFood("3 chicken thighs");

    // 192g is 3 x an assumed 64g thigh. Sainsbury's pack says fillet sizes vary and gives no
    // serving count, so there is nothing to source it from — it must not read as measured.
    expect(result.items[0].grams).toBeCloseTo(192, 0);
    expect(result.items[0].assumed).toBe("portionSize");
  });

  test("does not flag a counted pack item, whose portion is the unit itself", () => {
    expect(typeof parseFood).toBe("function");

    // A Veetee pot is a pot and a bagel is a bagel; only variable-size foods carry the flag.
    expect(parseFood("one Veetee sticky rice pot").items[0].assumed).toBeUndefined();
    expect(parseFood("four beetroot veggie cakes").items[0].assumed).toBeUndefined();
  });

  test("a bare mention of a whole-unit food means one of them, not a guess", () => {
    expect(typeof parseFood).toBe("function");

    const result = parseFood("peanut butter bagel");
    const bagel = result.items.find((item) => item.id === "protein-bagel");
    const peanutButter = result.items.find((item) => item.id === "peanut-butter");

    // "bagel" plainly means one bagel — reading Joe, not guessing at him.
    expect(bagel?.display).toBe("1 bagel");
    expect(bagel?.assumed).toBeUndefined();
    // Peanut butter has no natural amount, so 15g really is the app's number.
    expect(peanutButter?.assumed).toBe("quantity");
  });

  test("a stated weight overrides the assumption entirely", () => {
    expect(typeof parseFood).toBe("function");

    expect(parseFood("3 chicken thighs (392g uncooked)").items[0].assumed).toBeUndefined();
  });
});

/**
 * "150g of uncooked pesto pasta" is one noun phrase, and English compounds are head-final:
 * the pesto describes the pasta, and the weight belongs to the pasta. The parser used to give
 * the 150g to the pesto — it sat between the number and the pasta — and left the pasta on its
 * 100g default. That is 150g of pesto, 468 kcal and 43g of fat, from a sentence about pasta.
 */
describe("a weight in front of a compound like 'pesto pasta'", () => {
  const line = "I am about to have 3 chicken thighs and 150g of uncooked pesto pasta";

  test("gives the weight to the food the compound is about", () => {
    const pasta = parseFood(line).items.find((item) => item.id === "pasta");
    expect(pasta?.weighedGrams).toBe(150);
    expect(pasta?.weighedAs).toBe("uncooked");
    expect(pasta?.grams).toBeCloseTo(337.5, 1);
    expect(pasta?.assumed).toBeUndefined();
  });

  test("leaves the sauce as an unstated spoonful, and says so", () => {
    const pesto = parseFood(line).items.find((item) => item.id === "pesto");
    expect(pesto?.grams).toBeCloseTo(15, 1);
    expect(pesto?.assumed).toBe("quantity");
  });

  test("still reads the rest of the sentence", () => {
    const result = parseFood(line);
    // Chips come out in the order Joe said them, so the sauce reads before the pasta it is on.
    expect(result.items.map((item) => item.id)).toEqual(["chicken-thigh", "pesto", "pasta"]);
    expect(result.items[0].grams).toBe(192);
    expect(result.items[0].assumed).toBe("portionSize");
    expect(result.unknown).toHaveLength(0);
  });

  test("the whole line comes to something a pasta dish could plausibly be", () => {
    const items = parseFood(line).items;
    const kcal = items.reduce((sum, item) => sum + item.calories, 0);
    const fat = items.reduce((sum, item) => sum + item.fat, 0);
    // Was 955 kcal and 57.9g of fat, almost half of it pesto.
    expect(kcal).toBeCloseTo(922.9, 1);
    expect(fat).toBeCloseTo(21.2, 1);
  });

  test("a conjunction still separates two foods", () => {
    const items = parseFood("200g chicken thighs and broccoli").items;
    // A stated meat weight is read as uncooked, so 200g of raw thigh is 144g cooked.
    expect(items.find((item) => item.id === "chicken-thigh")?.weighedGrams).toBeCloseTo(200, 1);
    expect(items.find((item) => item.id === "broccoli")?.assumed).toBe("quantity");
  });

  /**
   * The known limit of reading a compound head-first. Two food names with nothing between them
   * are read as one dish, so the weight goes to the last — which is right for "pesto pasta"
   * and wrong for a list written without a conjunction. The loser is flagged `assumed`, so it
   * is visible rather than silent.
   */
  test("two foods jammed together with no conjunction read as one dish", () => {
    const items = parseFood("200g chicken thighs broccoli").items;
    expect(items.find((item) => item.id === "broccoli")?.grams).toBeCloseTo(200, 1);
    // He gave a weight and it went elsewhere, so the chicken is short of an amount rather than
    // short of a portion size — "say the amount" is the useful thing to tell him.
    expect(items.find((item) => item.id === "chicken-thigh")?.assumed).toBe("quantity");
  });
});

describe("three ways a stated fact went missing", () => {
  /** A phone keyboard types ’ rather than '. Joe logs from his phone. */
  test("reads a curly apostrophe the same as a straight one", () => {
    for (const line of ["100g chicken and Nando’s sauce", "100g chicken and Nando's sauce"]) {
      const result = parseFood(line);
      expect(result.items.map((item) => item.id)).toContain("nandos");
      expect(result.unknown).toHaveLength(0);
    }
  });

  test("knows the sauce by the name it is actually written with", () => {
    for (const name of ["nando's sauce", "nandos sauce", "nando's peri peri sauce", "peri peri sauce"]) {
      expect(parseFood(`200g chicken and ${name}`).unknown).toHaveLength(0);
    }
  });

  /**
   * "192g cooked chicken" was logged as 138g. The basis word sits inside the alias `cooked
   * chicken`, so the scan of the words in front of it found nothing and fell back to reading
   * the weight as uncooked — converting away a quarter of the chicken Joe had just weighed.
   */
  test("an alias that opens with a basis word is stating the basis", () => {
    const cooked = parseFood("192g cooked chicken").items[0];
    expect(cooked.grams).toBe(192);
    expect(cooked.weighedGrams).toBeUndefined();

    // Said the other way, the conversion still happens and still shows.
    const uncooked = parseFood("192g raw chicken thighs").items[0];
    expect(uncooked.weighedGrams).toBe(192);
    expect(uncooked.grams).toBeCloseTo(138.2, 1);
  });

  test("the example meal on the dashboard now parses back to itself", () => {
    const result = parseFood("192g cooked chicken, one Veetee sticky rice pot and Nando's sauce");
    expect(result.items.map((item) => item.id)).toEqual(["chicken-thigh", "sticky-rice", "nandos"]);
    expect(result.items[0].grams).toBe(192);
    expect(result.unknown).toHaveLength(0);
  });
});

/**
 * "250g of mince, a veetee pot, mixed veg" priced the mince and silently binned the other two,
 * so a 294 kcal preview stood in for a meal with a rice pot and a plate of veg in it. The
 * parser knew — `unknown` had both — and nothing was showing it.
 */
describe("saying what was not recognised", () => {
  const line = "250g of mince, a veetee pot, mixed veg";

  test("hands back the words as Joe wrote them, not a stripped remnant", () => {
    expect(parseFood(line).unknown).toEqual(["a veetee pot", "mixed veg"]);
  });

  test("does not report the parts it did understand", () => {
    expect(parseFood("250g of mince and 100g broccoli").unknown).toHaveLength(0);
  });

  test("suggests the foods an unrecognised phrase might have meant", () => {
    const suggestions = suggestFoods("a veetee pot");
    expect(suggestions).toContain("Veetee sticky rice pot");
    expect(suggestions).toContain("Veetee jasmine rice pot");
  });

  /**
   * Two Veetee pots are stocked and "a veetee pot" does not say which. Guessing one is exactly
   * the move this app is built against — so it asks, rather than quietly picking the cheaper
   * of the two by 4 kcal.
   */
  test("does not resolve an ambiguous product to one of the candidates", () => {
    expect(parseFood("a veetee pot").items).toHaveLength(0);
  });

  test("suggests nothing rather than reaching, when nothing is close", () => {
    expect(suggestFoods("mixed veg")).toHaveLength(0);
    expect(suggestFoods("quinoa")).toHaveLength(0);
  });

  test("a scanned food is offered too", () => {
    const scanned = { id: "pantry:1", name: "skyr", aliases: ["skyr"], basis: "100g" as const, calories: 63, protein: 11, carbs: 4, fat: 0.2, fibre: 0 };
    expect(suggestFoods("strawberry skyr", [scanned])).toContain("skyr");
  });
});

describe("eggs, and how a food was cooked", () => {
  test("knows an egg, and flags the size of a counted one", () => {
    expect(parseFood("2 eggs").items[0].grams).toBe(100);
    expect(parseFood("2 eggs").items[0].assumed).toBe("portionSize");
    expect(parseFood("100g free range eggs").items[0].calories).toBeCloseTo(143, 1);
    expect(parseFood("3 scrambled eggs").unknown).toHaveLength(0);
  });

  /**
   * Treating "grilled" as noise to be ignored gets it out of the way of the unknown scan but
   * not out of the way of the weight scan — "200g grilled chicken" logged one 64g thigh, a
   * stated weight lost to an adjective. It is read as a basis word, so the number reaches the
   * food and the chicken is taken as cooked rather than converted down as if it were raw.
   */
  test("a stated weight reaches the food across the way it was cooked", () => {
    const grilled = parseFood("200g grilled chicken").items[0];
    expect(grilled.grams).toBe(200);
    expect(grilled.weighedGrams).toBeUndefined();
    expect(parseFood("100g pan-fried salmon").items[0].grams).toBe(100);
    expect(parseFood("3 grilled chicken thighs").items[0].grams).toBe(192);
  });

  test("raw still converts, in the other direction", () => {
    const raw = parseFood("192g raw chicken thighs").items[0];
    expect(raw.weighedGrams).toBe(192);
    expect(raw.grams).toBeCloseTo(138.2, 1);
  });

  test("reads a whole plate without dropping anything", () => {
    const result = parseFood("3 scrambled eggs and 200g grilled chicken");
    expect(result.items.map((item) => item.id)).toEqual(["egg", "chicken-thigh"]);
    expect(result.items[1].grams).toBe(200);
    expect(result.unknown).toHaveLength(0);
  });
});

describe("what 'not counted' actually names", () => {
  test("reports the part that was missed, not the part that was counted", () => {
    const result = parseFood("a chicken katsu curry");
    expect(result.items.map((item) => item.id)).toEqual(["chicken-thigh"]);
    // The "a" went to the chicken as its count, so it is not left over either.
    expect(result.unknown).toEqual(["katsu curry"]);
  });

  test("keeps a weight that belonged to something it did not know", () => {
    expect(parseFood("200g quinoa").unknown).toEqual(["200g quinoa"]);
  });
});
