/**
 * Looking up a food Joe has not got stored, by name.
 *
 * This is the weakest of the three ways the app gets numbers, and it is deliberately last in
 * line. Scanning a barcode is exact; reading the packet is exact; searching by name is a guess
 * at which of several thousand products he meant, and it has been wrong before — "Sainsbury's
 * peanut butter" currently returns a Canadian sponge cake. So results are marked `provisional`
 * and the chat is told to say a figure came from a lookup.
 *
 * Two things it must get right regardless:
 *
 *  - **A database outage is not an empty shelf.** The old `/cgi/search.pl` endpoint started
 *    returning 503 and this function reported it as "nothing found", so the chat told Joe a
 *    food did not exist when the truth was that nobody had asked. `unreachable` now says which.
 *  - Missing fibre is recorded as 0 with `fibreUnknown` set, never silently as a real zero.
 */
import type { Macros } from "./food-parser";

export type LookedUpFood = {
  name: string;
  brand: string;
  quantity: string;
  per100g: Macros;
  /** The database published no fibre figure; the 0 above is a placeholder, not a reading. */
  fibreUnknown: boolean;
  provisional: true;
  url: string;
};

export type LookupResult = { foods: LookedUpFood[]; unreachable: boolean };

const ENDPOINT = "https://search.openfoodfacts.org/search";
const TIMEOUT_MS = 12_000;

const num = (value: unknown): number | undefined => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const round1 = (value: number) => Number(value.toFixed(1));

type Hit = {
  product_name?: string;
  brands?: string[] | string;
  quantity?: string;
  code?: string;
  countries_tags?: string[];
  nutriments?: Record<string, unknown>;
};

/** Search Open Food Facts by name, UK entries preferred. */
export async function searchFoodDatabase(query: string, limit = 4): Promise<LookupResult> {
  const wanted = query.trim();
  if (!wanted) return { foods: [], unreachable: false };

  const url = `${ENDPOINT}?${new URLSearchParams({ q: wanted, page_size: "20" })}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let hits: Hit[] = [];
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "joe-nutritionist/1.0 (personal nutrition tracker)" },
    });
    if (!response.ok) return { foods: [], unreachable: true };
    hits = ((await response.json()) as { hits?: Hit[] }).hits ?? [];
  } catch {
    return { foods: [], unreachable: true };
  } finally {
    clearTimeout(timer);
  }

  const seen = new Set<string>();
  const results: Array<LookedUpFood & { uk: number }> = [];

  for (const hit of hits) {
    const n = hit.nutriments ?? {};
    const calories = num(n["energy-kcal_100g"]);
    const protein = num(n["proteins_100g"]);
    const carbs = num(n["carbohydrates_100g"]);
    const fat = num(n["fat_100g"]);
    // Without the four headline figures there is nothing worth quoting.
    if (calories === undefined || protein === undefined || carbs === undefined || fat === undefined) continue;

    const name = (hit.product_name ?? "").trim();
    if (!name) continue;
    const brand = (Array.isArray(hit.brands) ? hit.brands[0] : (hit.brands ?? "").split(",")[0])?.trim() ?? "";
    const key = `${brand}|${name}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const fibre = num(n["fiber_100g"]);
    results.push({
      name,
      brand,
      quantity: (hit.quantity ?? "").trim(),
      per100g: { calories: round1(calories), protein: round1(protein), carbs: round1(carbs), fat: round1(fat), fibre: round1(fibre ?? 0) },
      fibreUnknown: fibre === undefined,
      provisional: true,
      url: hit.code ? `https://world.openfoodfacts.org/product/${hit.code}` : ENDPOINT,
      uk: hit.countries_tags?.includes("en:united-kingdom") ? 0 : 1,
    });
  }

  const foods = results
    .sort((a, b) => a.uk - b.uk)
    .slice(0, limit)
    .map(({ uk: _uk, ...food }) => food);

  return { foods, unreachable: false };
}
