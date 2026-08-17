/**
 * Looking up a food Joe has not got stored.
 *
 * `FOODS` covers his usual shop and nothing else, so the chat used to dead-end the moment he
 * said "0% Greek yoghurt" — it could not price it and, correctly, would not invent it. This
 * gives it somewhere to look instead.
 *
 * Open Food Facts is community-maintained, which makes it weaker than the labels behind
 * `FOODS`: the same product can appear several times with different numbers, and some entries
 * have no nutrition at all. So results are filtered to entries that actually carry the macros,
 * UK products are preferred, and every result is marked `provisional` — the chat is told to say
 * a figure came from a lookup, and to prefer numbers Joe reads off the packet in front of him.
 */
import type { Macros } from "./food-parser";

export type LookedUpFood = {
  name: string;
  brand: string;
  quantity: string;
  per100g: Macros;
  provisional: true;
  url: string;
};

const ENDPOINT = "https://world.openfoodfacts.org/cgi/search.pl";
const TIMEOUT_MS = 12_000;

const num = (value: unknown): number | undefined => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const round1 = (value: number) => Number(value.toFixed(1));

type OffProduct = {
  product_name?: string;
  brands?: string;
  quantity?: string;
  code?: string;
  countries_tags?: string[];
  nutriments?: Record<string, unknown>;
};

/** Search Open Food Facts for a food, newest-first by relevance, UK entries preferred. */
export async function searchFoodDatabase(query: string, limit = 4): Promise<LookedUpFood[]> {
  const wanted = query.trim();
  if (!wanted) return [];

  const url = `${ENDPOINT}?${new URLSearchParams({
    search_terms: wanted,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "20",
    fields: "product_name,brands,quantity,code,countries_tags,nutriments",
  })}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let products: OffProduct[] = [];
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "joe-nutritionist/1.0 (personal nutrition tracker)" },
    });
    if (!response.ok) return [];
    products = ((await response.json()) as { products?: OffProduct[] }).products ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }

  const seen = new Set<string>();
  const results: Array<LookedUpFood & { uk: number }> = [];

  for (const product of products) {
    const n = product.nutriments ?? {};
    const calories = num(n["energy-kcal_100g"]);
    const protein = num(n["proteins_100g"]);
    const carbs = num(n["carbohydrates_100g"]);
    const fat = num(n["fat_100g"]);
    // Without energy and protein there is nothing worth quoting; fibre is often simply absent.
    if (calories === undefined || protein === undefined || carbs === undefined || fat === undefined) continue;

    const name = (product.product_name ?? "").trim();
    if (!name) continue;
    const brand = (product.brands ?? "").split(",")[0]?.trim() ?? "";
    const key = `${brand}|${name}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      name,
      brand,
      quantity: (product.quantity ?? "").trim(),
      per100g: {
        calories: round1(calories),
        protein: round1(protein),
        carbs: round1(carbs),
        fat: round1(fat),
        fibre: round1(num(n["fiber_100g"]) ?? 0),
      },
      provisional: true,
      url: product.code ? `https://world.openfoodfacts.org/product/${product.code}` : ENDPOINT,
      uk: product.countries_tags?.includes("en:united-kingdom") ? 0 : 1,
    });
  }

  return results
    .sort((a, b) => a.uk - b.uk)
    .slice(0, limit)
    .map(({ uk: _uk, ...food }) => food);
}
