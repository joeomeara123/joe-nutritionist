import { describe, expect, test } from "bun:test";

import { amountForParser, buildPantryFood, checkName, readPantry, toFood, writePantry, type PantryFood } from "../lib/pantry";
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
    // "english butter" overlaps the stored "butter", so a scan taking it shadows that entry.
    expect(checkName("english butter")).toEqual({ ok: true, shadows: "Butter" });
    expect(parseFood("2 kerrygold", [toFood(entry)]).items[0].grams).toBe(20);
  });
});

describe("naming a scanned food", () => {
  /**
   * The pack in Joe's hand is the more specific truth, so it takes the name. Refusing it was
   * the wrong call — the first thing he tried to scan was salmon, and every sensible name for
   * it was rejected because the app already had a generic entry.
   */
  test("lets a scan take a stocked food's name, and says which", () => {
    expect(checkName("salmon")).toEqual({ ok: true, shadows: "Cooked salmon" });
    expect(checkName("peanut butter")).toEqual({ ok: true, shadows: "Peanut butter" });
  });

  /** "oil" would be swallowed by "olive oil"; "yogurt" is inside two stored aliases. */
  test("spots a name that sits inside an existing one, and the reverse", () => {
    expect(checkName("oil")).toEqual({ ok: true, shadows: "Olive oil" });
    expect(checkName("extra virgin olive oil that i bought")).toEqual({ ok: true, shadows: "Olive oil" });
  });

  test("says nothing when a name is genuinely new", () => {
    expect(checkName("greek yogurt")).toEqual({ ok: true });
    expect(checkName("skyr")).toEqual({ ok: true });
  });

  /** Two scans answering to one word is just ambiguity — there is no more-specific one. */
  test("refuses a name another scanned food already answers to", () => {
    expect(checkName("greek yogurt", [yogurt()])).toEqual({ ok: false, problem: "already-scanned", food: "greek yogurt" });
  });

  test("lets a product keep its own name when it is rescanned", () => {
    expect(checkName("greek yogurt", [yogurt()], "01206111")).toEqual({ ok: true });
  });

  test("refuses a name with nothing in it", () => {
    for (const name of ["", "  ", "500"]) expect(checkName(name)).toEqual({ ok: false, problem: "not-a-name" });
  });
});

describe("a scanned food outranking a stocked one", () => {
  function salmon(): PantryFood {
    return buildPantryFood({
      barcode: "5000169001234",
      name: "salmon",
      per100g: { calories: 203, protein: 22.4, carbs: 0, fat: 12.7, fibre: 0 },
      fibreUnknown: false,
      edited: true,
    });
  }

  test("240g of the scanned salmon is priced from the pack, not the stored entry", () => {
    const parsed = parseFood("240g salmon", [toFood(salmon())]);

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].id).toBe("pantry:5000169001234");
    expect(parsed.items[0].protein).toBeCloseTo(53.8, 1);
    // The stored salmon is weighed cooked and would have converted the weight; the scanned
    // pack has no cooked ratio, so 240g stays 240g.
    expect(parsed.items[0].grams).toBe(240);
  });

  test("the chat resolves the same one", () => {
    expect(lookupFood("salmon", [toFood(salmon())])?.id).toBe("pantry:5000169001234");
    expect(lookupFood("salmon")?.id).toBe("salmon");
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

describe("the amount Joe types after scanning", () => {
  /** The parser reads weights and bare counts. A serving noun would fall through to the
   *  portion default and then be flagged as an amount the app supplied — backwards, when he
   *  has just told it. */
  test("keeps a weight as it stands", () => {
    expect(amountForParser("150g")).toBe("150g");
    expect(amountForParser(" 40 g ")).toBe("40 g");
    expect(amountForParser("250ml")).toBe("250ml");
  });

  test("reduces a counted serving to the count", () => {
    expect(amountForParser("1 pot")).toBe("1");
    expect(amountForParser("2 servings")).toBe("2");
    expect(amountForParser("one slice")).toBe("one");
    expect(amountForParser("3")).toBe("3");
  });

  test("leaves anything else for the parser to complain about", () => {
    expect(amountForParser("")).toBe("");
    expect(amountForParser("a good scoop")).toBe("a good scoop");
  });

  test("a counted serving is not flagged as an amount the app supplied", () => {
    const pot = buildPantryFood({
      barcode: "5016805010255",
      name: "veetee pot",
      per100g: { calories: 152, protein: 2.3, carbs: 31.7, fat: 1.8, fibre: 0.6 },
      fibreUnknown: false,
      edited: true,
      product: { servingGrams: 130, servingLabel: "pot" },
    });
    const parsed = parseFood(`${amountForParser("1 pot")} veetee pot`, [toFood(pot)]);

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].grams).toBe(130);
    expect(parsed.items[0].assumed).toBeUndefined();
  });
});
