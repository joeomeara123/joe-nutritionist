/**
 * The pantry: foods Joe has scanned, remembered between sessions.
 *
 * A scan that only priced one meal would not be worth the camera. The point is that scanning
 * a jar once turns it into a food — so "40g of it" works in the add-food box, in the chat and
 * in the diary from then on, exactly like the stocked foods do. So the pantry is merged into
 * the catalogue everywhere `FOODS` is read, rather than living in a parallel system.
 *
 * `FOODS` itself is never touched. Its entries are label-sourced, order-sensitive (the cooking
 * fats sit last so "oil" cannot shadow "olive oil") and asserted complete by a test. Scanned
 * foods are appended to it at call time instead.
 */
import { FOODS, findAlias, type Food, type FoodSource, type Macros } from "./food-parser";

export type PantryFood = {
  id: string;
  barcode: string;
  /** What Joe calls it, which is also the only thing he has to type to log it. */
  name: string;
  per100g: Macros;
  /** Neither the database nor Joe gave a fibre figure, so the 0 below is a placeholder. */
  fibreUnknown: boolean;
  servingGrams?: number;
  servingLabel?: string;
  /** Straight from the database, unchecked against the packet in his hand. */
  provisional: boolean;
  source: FoodSource;
  addedAt: string;
};

export const PANTRY_KEY = "joe-gym-pantry-v1";
/** Returned by `aliasCollision` when the problem is the name itself, not a clash. */
export const NOT_A_NAME = "not a name";

type ScannedLike = {
  name?: string;
  brand?: string;
  url?: string;
  servingGrams?: number;
  servingLabel?: string;
  caloriesFromKilojoules?: boolean;
  convertedFromServing?: boolean;
};

export function buildPantryFood(args: {
  barcode: string;
  name: string;
  per100g: Macros;
  fibreUnknown: boolean;
  /** True when Joe typed or corrected the numbers, which makes them better than the database's. */
  edited: boolean;
  product?: ScannedLike;
  addedAt?: string;
}): PantryFood {
  const product = args.product ?? {};
  const notes = [
    args.edited ? "read off the packet by Joe" : "not checked against the packet",
    args.fibreUnknown ? "fibre is not published and is counted as 0" : "",
    product.caloriesFromKilojoules ? "calories converted from kilojoules" : "",
    product.convertedFromServing ? "per-100g column computed by the database from a per-serving panel" : "",
  ].filter(Boolean);

  return {
    id: `pantry:${args.barcode}`,
    barcode: args.barcode,
    name: args.name.trim().toLowerCase(),
    per100g: args.per100g,
    fibreUnknown: args.fibreUnknown,
    ...(product.servingGrams ? { servingGrams: product.servingGrams, servingLabel: product.servingLabel || "serving" } : {}),
    provisional: !args.edited,
    source: {
      product: [product.brand, product.name].filter(Boolean).join(" ") || args.name.trim(),
      url: product.url || `https://world.openfoodfacts.org/product/${args.barcode}`,
      basis: `per 100g, barcode ${args.barcode}; ${notes.join("; ")}`,
    },
    addedAt: args.addedAt ?? new Date().toISOString(),
  };
}

/** A pantry entry in the shape the parser and the chat tools already understand. */
export function toFood(entry: PantryFood): Food {
  return {
    id: entry.id,
    name: entry.name,
    aliases: [entry.name],
    basis: "100g",
    ...(entry.servingGrams ? { portionGrams: entry.servingGrams, portionLabel: entry.servingLabel ?? "serving" } : {}),
    ...entry.per100g,
    source: entry.source,
    provisional: entry.provisional,
    fibreUnknown: entry.fibreUnknown,
  };
}

export const pantryFoods = (pantry: PantryFood[]): Food[] => pantry.map(toFood);

/**
 * Is this name already spoken for?
 *
 * Checked in both directions, because the parser matches on whole words: a new "oil" would be
 * swallowed by the stored "olive oil", and a new "protein yogurt smoothie" would swallow the
 * stored "protein yogurt". Either way one of the two foods silently stops being reachable,
 * which is worse than making Joe pick a different word now.
 *
 * Returns the name of whatever it clashes with, or null when the name is free.
 */
export function aliasCollision(name: string, pantry: PantryFood[] = [], ignoreBarcode?: string): string | null {
  const wanted = name.trim().toLowerCase();
  if (wanted.length < 3 || !/[a-z]{3}/.test(wanted)) return NOT_A_NAME;

  const existing = [
    ...FOODS,
    ...pantry.filter((entry) => entry.barcode !== ignoreBarcode).map(toFood),
  ];

  for (const food of existing) {
    for (const alias of food.aliases) {
      if (alias === wanted || findAlias(wanted, alias) !== -1 || findAlias(alias, wanted) !== -1) return food.name;
    }
  }
  return null;
}

type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void };

const defaultStorage = (): StorageLike | null => (typeof window === "undefined" ? null : window.localStorage);

const isPantryFood = (value: unknown): value is PantryFood => {
  const entry = value as PantryFood | undefined;
  return Boolean(entry && typeof entry.barcode === "string" && typeof entry.name === "string" && entry.per100g && typeof entry.per100g.calories === "number");
};

export function readPantry(storage: StorageLike | null = defaultStorage()): PantryFood[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(PANTRY_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isPantryFood) : [];
  } catch {
    return [];
  }
}

export function writePantry(pantry: PantryFood[], storage: StorageLike | null = defaultStorage()): void {
  storage?.setItem(PANTRY_KEY, JSON.stringify(pantry));
}
