import { describe, expect, test } from "bun:test";

import { aliasCollision, buildPantryFood, readPantry, toFood, writePantry, type PantryFood } from "../lib/pantry";
import { parseFood } from "../lib/food-parser";
import { lookupFood, priceMeal, type DayState } from "../lib/nutrition-tools";
import { readProduct } from "../lib/barcode";

import butter from "./fixtures/off-01117011.json";

const DAY: DayState = { consumed: { calories: 600, protein: 50, carbs: 60, fat: 20, fibre: 8 }, mealCount: 1, hour: 13 };

function yogurt(name = "greek yogurt"): PantryFood {
  return buildPantryFood({
    barcode: "01206111",
    name,
    per100g: { calories: 103, protein: 4, carbs: 4.2, fat: 7.6, fibre: 0 },
    fibreUnknown: false,
    edited: false,
    product: { name: "Greek style natural yogurt", brand: "Sainsbury's", url: "https://world.openfoodfacts.org/product/01206111" },
  });
}

describe("a scanned product becoming a food", () => {
  test("parses out of the add-food box like anything else", () => {
    const parsed = parseFood("150g greek yogurt", [toFood(yogurt())]);

    expect(parsed.unknown).toHaveLength(0);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].calories).toBeCloseTo(154.5, 1);
    expect(parsed.items[0].protein).toBeCloseTo(6, 1);
  });

  test("mixes with the stocked foods in one sentence", () => {
    const parsed = parseFood("150g greek yogurt and 15g peanut butter", [toFood(yogurt())]);

    expect(parsed.unknown).toHaveLength(0);
    expect(parsed.items.map((item) => item.id).sort()).toEqual(["pantry:01206111", "peanut-butter"]);
  });

  test("the chat can price it too", () => {
    const priced = priceMeal([{ food: "greek yogurt", grams: 200 }], DAY, [toFood(yogurt())]);

    expect(priced.unknown).toHaveLength(0);
    expect(priced.total.calories).toBe(206);
  });

  test("is still unknown when the pantry is not passed in", () => {
    expect(parseFood("150g greek yogurt").unknown.length).toBeGreaterThan(0);
    expect(lookupFood("greek yogurt")).toBeNull();
  });

  test("carries a serving size through from the label", () => {
    const scan = readProduct(butter, "01117011");
    if (!scan.found) throw new Error("fixture should be found");

    const entry = buildPantryFood({
      barcode: scan.product.barcode,
      name: "kerrygold",
      per100g: { ...scan.product.per100g, fibre: 0 },
      fibreUnknown: false,
      edited: false,
      product: scan.product,
    });

    expect(entry.servingGrams).toBe(10);
    // "english butter" would have been refused as a name — the stored "butter" swallows it.
    expect(aliasCollision("english butter")).toBe("Butter");
    expect(parseFood("2 kerrygold", [toFood(entry)]).items[0].grams).toBe(20);
  });
});

describe("naming a scanned food", () => {
  test("refuses a name that already means something else", () => {
    expect(aliasCollision("peanut butter")).toBe("Peanut butter");
    expect(aliasCollision("chicken")).toBe("Cooked chicken thighs");
  });

  /** "oil" would be swallowed by "olive oil"; "yogurt" is inside two stored aliases. */
  test("refuses a name that sits inside an existing one, and the reverse", () => {
    expect(aliasCollision("oil")).not.toBeNull();
    expect(aliasCollision("yogurt")).not.toBeNull();
    expect(aliasCollision("extra virgin olive oil that i bought")).not.toBeNull();
  });

  test("accepts a name that is genuinely new", () => {
    expect(aliasCollision("greek yogurt")).toBeNull();
    expect(aliasCollision("skyr")).toBeNull();
  });

  test("refuses a name another scanned food already answers to", () => {
    expect(aliasCollision("greek yogurt", [yogurt()])).toBe("greek yogurt");
  });

  test("lets a product keep its own name when it is rescanned", () => {
    expect(aliasCollision("greek yogurt", [yogurt()], "01206111")).toBeNull();
  });

  test("refuses a name with nothing in it", () => {
    expect(aliasCollision("")).not.toBeNull();
    expect(aliasCollision("  ")).not.toBeNull();
    expect(aliasCollision("500")).not.toBeNull();
  });
});

describe("what gets remembered", () => {
  test("an unchecked scan says so in its source, a corrected one says that", () => {
    expect(yogurt().provisional).toBe(true);
    expect(yogurt().source.basis).toContain("not checked against the packet");

    const corrected = buildPantryFood({
      barcode: "01206111",
      name: "greek yogurt",
      per100g: { calories: 103, protein: 4, carbs: 4.2, fat: 7.6, fibre: 0 },
      fibreUnknown: false,
      edited: true,
      product: { name: "Greek style natural yogurt", brand: "Sainsbury's", url: "x" },
    });
    expect(corrected.provisional).toBe(false);
    expect(corrected.source.basis).toContain("read off the packet");
  });

  test("survives a round trip through storage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };

    writePantry([yogurt()], storage);
    const back = readPantry(storage);

    expect(back).toHaveLength(1);
    expect(back[0].name).toBe("greek yogurt");
    expect(toFood(back[0]).calories).toBe(103);
  });

  test("a corrupt store reads as an empty pantry rather than throwing", () => {
    const storage = { getItem: () => "{not json", setItem: () => {} };
    expect(readPantry(storage)).toEqual([]);
  });

  test("rescanning a product replaces its entry instead of duplicating it", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) };

    writePantry([yogurt()], storage);
    writePantry([...readPantry(storage).filter((entry) => entry.barcode !== "01206111"), yogurt("greek yog")], storage);

    const back = readPantry(storage);
    expect(back).toHaveLength(1);
    expect(back[0].name).toBe("greek yog");
  });
});
