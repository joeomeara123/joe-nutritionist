import { describe, expect, test } from "bun:test";

import { normaliseBarcode, readProduct } from "../lib/barcode";

import loaf from "./fixtures/off-01318180.json";
import mayonnaise from "./fixtures/off-01784060.json";
import butter from "./fixtures/off-01117011.json";
import nutella from "./fixtures/off-3017620422003.json";

/**
 * The four fixtures are real Open Food Facts responses, captured with curl. The two at the
 * bottom of this file are hand-built: they cover shapes I could not find a live example of
 * quickly, and a synthetic object is clearer than a 40kB capture for testing one rule.
 */

describe("normalising what came off the camera", () => {
  test("keeps the digits and drops everything else", () => {
    expect(normaliseBarcode(" 501 6805-010255 ")).toBe("5016805010255");
  });

  test("refuses something that is not a barcode", () => {
    expect(normaliseBarcode("12345")).toBeNull();
    expect(normaliseBarcode("chicken thighs")).toBeNull();
    expect(normaliseBarcode("123456789012345678")).toBeNull();
  });

  test("leaves leading zeros alone — Open Food Facts resolves them itself", () => {
    expect(normaliseBarcode("01206111")).toBe("01206111");
  });
});

describe("reading a product off a real Open Food Facts response", () => {
  test("takes the per-100g panel as it stands", () => {
    const result = readProduct(loaf, "01318180");
    if (!result.found) throw new Error(`expected a product, got ${result.reason}`);

    expect(result.product.name).toBe("MULTISEED WHOLEMEAL FARMHOUSE LOAF");
    expect(result.product.per100g.calories).toBe(270);
    expect(result.product.per100g.protein).toBe(12.8);
    expect(result.product.per100g.carbs).toBe(34.2);
    expect(result.product.per100g.fat).toBe(7.5);
    expect(result.product.per100g.fibre).toBe(7.4);
    expect(result.product.caloriesFromKilojoules).toBe(false);
  });

  /**
   * The whole point of the feature. Fibre is a hard 30g minimum, and Open Food Facts is
   * missing it on a lot of products — including one of these four. Recording the gap as 0
   * would quietly eat into a target Joe cannot afford to be wrong about.
   */
  test("reports missing fibre as unknown rather than as zero", () => {
    const result = readProduct(mayonnaise, "01784060");
    if (!result.found) throw new Error(`expected a product, got ${result.reason}`);

    expect(result.product.per100g.fibre).toBeNull();
    expect(result.product.per100g.calories).toBe(695);
  });

  test("keeps a real zero as a zero", () => {
    const result = readProduct(butter, "01117011");
    if (!result.found) throw new Error(`expected a product, got ${result.reason}`);
    expect(result.product.per100g.fibre).toBe(0);
  });

  test("picks up a serving size when the label states one", () => {
    const result = readProduct(butter, "01117011");
    if (!result.found) throw new Error(`expected a product, got ${result.reason}`);
    expect(result.product.servingGrams).toBe(10);
  });

  test("leaves the serving size off when the label does not give a weight", () => {
    const result = readProduct(nutella, "3017620422003");
    if (!result.found) throw new Error(`expected a product, got ${result.reason}`);
    expect(result.product.servingGrams).toBeUndefined();
    expect(result.product.brand).toBe("Nutella");
  });

  test("links back to the product page it came from", () => {
    const result = readProduct(nutella, "3017620422003");
    if (!result.found) throw new Error(`expected a product, got ${result.reason}`);
    expect(result.product.url).toContain("3017620422003");
  });
});

describe("responses that cannot be used", () => {
  test("an unknown barcode is not found", () => {
    const result = readProduct({ status: 0, status_verbose: "product not found" }, "0000000000000");
    expect(result.found).toBe(false);
    if (!result.found) expect(result.reason).toBe("not-in-database");
  });

  test("a product with no nutrition table says so, rather than reading as zeros", () => {
    const result = readProduct({ status: 1, product: { product_name: "Mystery", nutriments: {} } }, "111");
    expect(result.found).toBe(false);
    if (!result.found) expect(result.reason).toBe("no-nutrition");
  });

  test("a missing energy figure is not a zero-calorie food", () => {
    const bare = { status: 1, product: { product_name: "Bare", nutriments: { proteins_100g: 5, carbohydrates_100g: 5, fat_100g: 5 } } };
    const result = readProduct(bare, "111");
    expect(result.found).toBe(false);
    if (!result.found) expect(result.reason).toBe("no-nutrition");
  });

  test("derives calories from kilojoules when that is all the label published", () => {
    const kjOnly = {
      status: 1,
      product: {
        product_name: "Kilojoules only",
        nutriments: { "energy-kj_100g": 1000, proteins_100g: 5, carbohydrates_100g: 20, fat_100g: 2, fiber_100g: 1 },
      },
    };
    const result = readProduct(kjOnly, "111");
    if (!result.found) throw new Error(`expected a product, got ${result.reason}`);

    expect(result.product.per100g.calories).toBe(239);
    expect(result.product.caloriesFromKilojoules).toBe(true);
  });

  /**
   * Open Food Facts computes the per-100g column itself when the contributor entered a
   * per-serving panel, by dividing by a serving size that may itself be wrong. The figures
   * are usually fine, so this is flagged rather than refused — but it has to be visible.
   */
  test("flags a per-100g column the database worked out rather than read", () => {
    const perServing = {
      status: 1,
      product: {
        product_name: "Entered per serving",
        nutrition_data_per: "serving",
        serving_quantity: 30,
        nutriments: { "energy-kcal_100g": 400, proteins_100g: 10, carbohydrates_100g: 50, fat_100g: 15, fiber_100g: 2 },
      },
    };
    const result = readProduct(perServing, "111");
    if (!result.found) throw new Error(`expected a product, got ${result.reason}`);
    expect(result.product.convertedFromServing).toBe(true);
  });
});
