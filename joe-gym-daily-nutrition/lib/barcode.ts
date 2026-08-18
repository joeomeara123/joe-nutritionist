/**
 * Turning a barcode into a food.
 *
 * A barcode is the best retrieval key this app has. Every product mix-up so far came from
 * searching by name — a whipped feta instead of feta, a flavoured rice instead of plain, a
 * Canadian cake for "Sainsbury's peanut butter". A barcode is exact: one code, one product,
 * no ranking and nothing to pick between.
 *
 * What it is not is a guarantee of good numbers. Open Food Facts is community-maintained, so
 * this module's real job is separating what the database actually states from what it merely
 * implies. Three rules follow from that, and all three exist because a missing value that
 * renders like a measured one is indistinguishable from a correct answer at exactly the
 * moment it is wrong:
 *
 *  - Missing fibre is `null`, never 0. Fibre is a hard 30g minimum and a silent zero eats it.
 *  - A missing energy figure makes the product unusable, not a zero-calorie food.
 *  - A per-100g column the database *computed* from a per-serving panel is flagged, because
 *    it was divided by a serving size that may itself be wrong.
 */
import type { Macros } from "./food-parser";

/** Fibre is nullable here and nowhere else: `null` means the database has no figure at all. */
export type ScannedMacros = Omit<Macros, "fibre"> & { fibre: number | null };

export type ScannedProduct = {
  barcode: string;
  name: string;
  brand: string;
  packSize: string;
  per100g: ScannedMacros;
  servingGrams?: number;
  servingLabel?: string;
  /** The label published kilojoules only; the calories below are a conversion. */
  caloriesFromKilojoules: boolean;
  /** The per-100g column was worked out from a per-serving panel, not read off one. */
  convertedFromServing: boolean;
  url: string;
};

/** `invalid` is "that is not a barcode", which is not the same as "no such product". */
export type ScanFailure = "invalid" | "not-in-database" | "no-nutrition" | "unreachable";
export type ScanResult = { found: true; product: ScannedProduct } | { found: false; barcode: string; reason: ScanFailure };

const KJ_PER_KCAL = 4.184;
const round1 = (value: number) => Number(value.toFixed(1));

const num = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Strip the code down to its digits and sanity-check the length.
 *
 * Leading zeros are deliberately kept rather than trimmed to EAN-13: Open Food Facts
 * normalises codes itself, and `1206111`, `01206111` and `0001206111` all resolve to the same
 * Sainsbury's product. Padding it here would only be a second guess at something the database
 * already gets right.
 */
export function normaliseBarcode(input: string): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  // EAN-8 is the shortest real retail code; GTIN-14 the longest.
  if (digits.length < 6 || digits.length > 14) return null;
  return digits;
}


/**
 * A noun for one serving, out of whatever the label happened to say.
 *
 * `serving_size` is free text and arrives as "1 Pot (130g)", "2 teaspoons (10 g)", "30g" or
 * "1 slice". Only the noun is wanted — the weight is already in `serving_quantity`, and
 * repeating it produces hints like "e.g. 1 1 Pot (130g)". A serving that is more than one of
 * something has no single-item noun, so it stays "serving" rather than being pluralised wrong.
 */
function readServingLabel(raw: string): string {
  const text = raw.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const counted = text.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  const noun = counted ? (Number(counted[1]) === 1 ? counted[2] : "") : text;
  // "30g" is a weight, not a noun; anything with a digit left in it is not a name for a thing.
  return noun && !/\d/.test(noun) ? noun : "serving";
}

type OffResponse = { status?: number; product?: Record<string, unknown> };

export function readProduct(raw: unknown, barcode: string): ScanResult {
  const response = (raw ?? {}) as OffResponse;
  const product = response.product;
  if (response.status !== 1 || !product) return { found: false, barcode, reason: "not-in-database" };

  const n = (product.nutriments ?? {}) as Record<string, unknown>;

  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);

  // Energy is the one figure with a fallback: plenty of labels publish kilojoules only.
  const kcal = num(n["energy-kcal_100g"]);
  const kj = num(n["energy-kj_100g"]) ?? num(n.energy_100g);
  const calories = kcal ?? (kj === undefined ? undefined : round1(kj / KJ_PER_KCAL));

  if (calories === undefined || protein === undefined || carbs === undefined || fat === undefined) {
    return { found: false, barcode, reason: "no-nutrition" };
  }

  const fibre = num(n.fiber_100g);
  const servingGrams = num(product.serving_quantity);
  const servingLabel = readServingLabel(typeof product.serving_size === "string" ? product.serving_size : "");

  return {
    found: true,
    product: {
      barcode,
      name: typeof product.product_name === "string" ? product.product_name.trim() : "",
      brand: String(product.brands ?? "").split(",")[0]?.trim() ?? "",
      packSize: String(product.quantity ?? "").trim(),
      per100g: {
        calories: round1(calories),
        protein: round1(protein),
        carbs: round1(carbs),
        fat: round1(fat),
        fibre: fibre === undefined ? null : round1(fibre),
      },
      ...(servingGrams ? { servingGrams, servingLabel } : {}),
      caloriesFromKilojoules: kcal === undefined,
      convertedFromServing: product.nutrition_data_per === "serving",
      url: `https://world.openfoodfacts.org/product/${barcode}`,
    },
  };
}
