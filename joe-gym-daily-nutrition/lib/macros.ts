/**
 * Macros Joe types in himself.
 *
 * Everywhere else in this app a number is derived — parsed from a sentence, scaled from a
 * label, solved by a tool. That is the right default and it is also a closed world: a
 * restaurant meal has no barcode, and a mis-parsed meal sits in the diary being wrong with no
 * way to say "the number is 62g, just take it".
 *
 * A figure Joe read off a menu or a packet is better than anything the app can derive, so a
 * hand-entered meal is the most authoritative kind of entry there is. The only thing that has
 * to stay visible is that it came from him rather than from a food.
 */
import type { Macros } from "./food-parser";

export const MACRO_FIELDS = [
  { key: "calories", label: "kcal" },
  { key: "protein", label: "protein" },
  { key: "carbs", label: "carbs" },
  { key: "fat", label: "fat" },
  { key: "fibre", label: "fibre" },
] as const;

export type MacroKey = (typeof MACRO_FIELDS)[number]["key"];
/** Strings rather than numbers, so an empty box reads as "no figure" and not as "none of it". */
export type MacroDraft = Record<MacroKey, string>;

export const EMPTY_DRAFT: MacroDraft = { calories: "", protein: "", carbs: "", fat: "", fibre: "" };

/** Calories, protein, carbs and fat. Fibre is the one that may legitimately be missing. */
const REQUIRED = ["calories", "protein", "carbs", "fat"] as const;

const round1 = (value: number) => Number(value.toFixed(1));

export function asNumber(value: string): number | null {
  const text = (value ?? "").trim();
  if (text === "") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * The five figures, or null if the entry is not usable.
 *
 * A missing required figure fails the whole entry rather than defaulting to zero: a plate of
 * food is not 0g of protein, and an entry that silently reads as one is worse than no entry.
 * Fibre is the exception — blank counts as zero because it has to count as something, and
 * `fibreUnknown` is what lets the app say so instead of implying it was measured.
 */
export function readMacros(draft: MacroDraft): { macros: Macros; fibreUnknown: boolean } | null {
  const values = {} as Record<MacroKey, number | null>;
  for (const field of MACRO_FIELDS) values[field.key] = asNumber(draft[field.key]);
  if (REQUIRED.some((key) => values[key] === null)) return null;

  return {
    macros: {
      calories: values.calories!,
      protein: values.protein!,
      carbs: values.carbs!,
      fat: values.fat!,
      fibre: values.fibre ?? 0,
    },
    fibreUnknown: values.fibre === null,
  };
}

/**
 * What a label would probably say, from the other four figures.
 *
 * UK labels exclude fibre from carbohydrate and count it at roughly 2 kcal/g, hence the extra
 * term. Only ever offered as something to tap: Atwater factors approximate a label rather than
 * reproducing it, and a number the app quietly fills in is the failure this app exists to stop.
 */
export function estimateCalories(draft: MacroDraft): number | null {
  const protein = asNumber(draft.protein);
  const carbs = asNumber(draft.carbs);
  const fat = asNumber(draft.fat);
  if (protein === null || carbs === null || fat === null) return null;
  return Math.round(protein * 4 + carbs * 4 + fat * 9 + (asNumber(draft.fibre) ?? 0) * 2);
}

/** Fill the boxes from a meal already logged, so correcting one figure does not retype five. */
export function draftFromMacros(macros: Macros, fibreUnknown = false): MacroDraft {
  return {
    calories: String(round1(macros.calories)),
    protein: String(round1(macros.protein)),
    carbs: String(round1(macros.carbs)),
    fat: String(round1(macros.fat)),
    fibre: fibreUnknown ? "" : String(round1(macros.fibre)),
  };
}
