export type Macros = { calories: number; protein: number; carbs: number; fat: number; fibre: number };
/**
 * `rawYield` is the cooked-to-raw weight ratio. Foods stored on a cooked basis need it so a
 * raw weighing (how Joe actually weighs meat) converts instead of being priced as cooked.
 */
export type Food = Macros & { id: string; name: string; aliases: string[]; basis: "100g" | "portion"; portionGrams?: number; portionLabel?: string; rawYield?: number };
/** `assumed` marks a quantity the parser supplied because Joe did not state one. */
export type ParsedFood = Macros & { id: string; name: string; grams: number; display: string; fromRawGrams?: number; assumed?: boolean };

export const FOODS: Food[] = [
  { id: "chicken-thigh", name: "Cooked chicken thighs", aliases: ["chicken thighs", "chicken thigh", "cooked chicken", "chicken"], basis: "100g", portionGrams: 64, portionLabel: "thigh", rawYield: 0.72, calories: 168, protein: 24.8, carbs: 0, fat: 7.6, fibre: 0 },
  { id: "mince", name: "Cooked 5% beef mince", aliases: ["5% mince", "five percent mince", "beef mince", "mince meat", "mince"], basis: "100g", rawYield: 0.7, calories: 168, protein: 31, carbs: 0, fat: 4.7, fibre: 0 },
  { id: "steak", name: "Cooked sirloin steak", aliases: ["sirloin steak", "steak"], basis: "100g", rawYield: 0.75, calories: 189, protein: 27.7, carbs: 0, fat: 8.7, fibre: 0 },
  { id: "salmon", name: "Cooked salmon", aliases: ["salmon fillets", "salmon fillet", "salmon"], basis: "100g", rawYield: 0.8, calories: 247, protein: 24.1, carbs: 0, fat: 16.4, fibre: 0 },
  { id: "sticky-rice", name: "Veetee sticky rice pot", aliases: ["veetee sticky rice", "vt sticky rice", "sticky rice pot", "sticky rice", "veetee cooked rice", "vt cooked rice", "veetee rice pot", "vt rice pot", "veetee rice", "vt rice"], basis: "portion", portionGrams: 130, portionLabel: "pot", calories: 198, protein: 3, carbs: 41.2, fat: 2.3, fibre: 0 },
  { id: "jasmine-rice", name: "Veetee jasmine rice pot", aliases: ["veetee jasmine rice", "vt jasmine rice", "jasmine rice pot", "jasmine rice"], basis: "portion", portionGrams: 140, portionLabel: "pot", calories: 202, protein: 4.1, carbs: 40.7, fat: 2.1, fibre: 1.7 },
  { id: "pasta", name: "Dry fusilli pasta", aliases: ["fusilli pasta", "dry pasta", "pasta"], basis: "100g", calories: 359, protein: 12, carbs: 72, fat: 1.5, fibre: 3.5 },
  { id: "broccoli", name: "Broccoli", aliases: ["broccoli"], basis: "100g", calories: 35, protein: 2.4, carbs: 4.4, fat: 0.4, fibre: 3.3 },
  { id: "peppers", name: "Sweet peppers", aliases: ["sweet peppers", "bell peppers", "pepper", "peppers"], basis: "100g", calories: 27, protein: 1, carbs: 5.3, fat: 0.3, fibre: 1.8 },
  { id: "avocado", name: "Avocado", aliases: ["avocado"], basis: "100g", calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fibre: 6.7 },
  { id: "feta", name: "Feta", aliases: ["feta cheese", "feta"], basis: "100g", calories: 276, protein: 14.2, carbs: 0.8, fat: 23, fibre: 0 },
  // Condiments carry a portion size so an unquantified mention costs a spoonful rather than
  // the 100g fallback — 100g of pesto is 455 kcal, which quietly wrecks a day's numbers.
  { id: "pesto", name: "Green pesto", aliases: ["green pesto", "pesto"], basis: "100g", portionGrams: 15, portionLabel: "tbsp", calories: 455, protein: 4.7, carbs: 5.6, fat: 46.1, fibre: 1 },
  { id: "chips", name: "Oven chips", aliases: ["gastro chips", "oven chips", "chips"], basis: "100g", calories: 236, protein: 3.3, carbs: 31.6, fat: 10.4, fibre: 3.3 },
  { id: "nandos", name: "Nando's PERi-PERi sauce", aliases: ["nando's hot sauce", "nandos hot sauce", "nando sauce", "nandos sauce", "peri-peri sauce", "peri peri sauce"], basis: "portion", portionGrams: 20, portionLabel: "serving", calories: 9, protein: 0.2, carbs: 0.5, fat: 0.5, fibre: 0.3 },
  { id: "protein-yogurt", name: "High-protein yoghurt", aliases: ["high protein yoghurt", "high protein yogurt", "protein yoghurt", "protein yogurt"], basis: "100g", calories: 73, protein: 10, carbs: 5.1, fat: 0.8, fibre: 0 },
  { id: "protein-bagel", name: "Protein bagel", aliases: ["protein boost bagel", "protein bagel", "bagel"], basis: "portion", portionGrams: 68, portionLabel: "bagel", calories: 194, protein: 10.6, carbs: 26.5, fat: 5, fibre: 4.4 },
  { id: "peanut-butter", name: "Peanut butter", aliases: ["smooth peanut butter", "peanut butter"], basis: "100g", portionGrams: 15, portionLabel: "serving", calories: 606, protein: 26, carbs: 16, fat: 47, fibre: 8.1 },
  { id: "veggie-cakes", name: "Beetroot veggie cakes", aliases: ["beetroot and balsamic veggie cakes", "beetroot veggie cakes", "veggie cakes", "rice cakes"], basis: "portion", portionGrams: 9.38, portionLabel: "cake", calories: 40, protein: 2.4, carbs: 4.8, fat: 1.1, fibre: 0.6 },
  // Cooking fats sit last on purpose: their short aliases ("oil", "butter") would otherwise
  // shadow longer names that contain them, e.g. "peanut butter".
  { id: "olive-oil", name: "Olive oil", aliases: ["extra virgin olive oil", "olive oil", "vegetable oil", "rapeseed oil", "cooking oil", "oil"], basis: "100g", portionGrams: 13.5, portionLabel: "tbsp", calories: 884, protein: 0, carbs: 0, fat: 100, fibre: 0 },
  { id: "butter", name: "Butter", aliases: ["salted butter", "unsalted butter", "butter"], basis: "100g", portionGrams: 10, portionLabel: "knob", calories: 744, protein: 0.6, carbs: 0.6, fat: 82, fibre: 0 },
];

const numberWords: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };
const round = (value: number, places = 0) => Number(value.toFixed(places));

/** Numerals count as much as number words — Joe types "3 chicken thighs" as often as "three". */
const COUNT = "\\d+(?:\\.\\d+)?|a|an|one|two|three|four";
const countOf = (token: string) => (token in numberWords ? numberWords[token] : Number(token));

/** "cooked" is a prefix of "uncooked", so the longer word has to be tried first. */
const BASIS = "uncooked|cooked|raw";
const isRaw = (basis?: string) => basis === "raw" || basis === "uncooked";

const GENERIC_TBSP_GRAMS = 15;

/**
 * A spoon is a real measurement to Joe and a silent 100g fallback otherwise. Foods that store
 * their own tablespoon (olive oil is 13.5g, not 15g) use it; a teaspoon is a third of one.
 */
function spoonGrams(food: Food, unit: string): number {
  const tbsp = food.portionLabel === "tbsp" && food.portionGrams ? food.portionGrams : GENERIC_TBSP_GRAMS;
  return unit.startsWith("tsp") || unit.startsWith("teaspoon") ? tbsp / 3 : tbsp;
}

export function scaled(food: Food, grams: number): ParsedFood {
  const factor = food.basis === "100g" ? grams / 100 : grams / (food.portionGrams || grams);
  const portionCount = food.basis === "portion" && food.portionGrams ? grams / food.portionGrams : 0;
  const isWholePortionCount = portionCount > 0 && Math.abs(portionCount - Math.round(portionCount)) < 0.001;
  const display = isWholePortionCount
    ? `${Math.round(portionCount)} ${food.portionLabel}${Math.round(portionCount) === 1 ? "" : "s"}`
    : `${round(grams)}g`;
  return {
    id: food.id,
    name: food.name,
    grams,
    display,
    calories: food.calories * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
    fibre: food.fibre * factor,
  };
}

// Words that carry no food identity, so a leftover fragment made only of these is not an
// unrecognised food — it is the grammar around one we already matched.
const FILLER =
  /\b(a|an|one|two|three|four|and|with|plus|of|some|the|my|then|also|served|side|sides|bowl|plate|portion|portions|cooked|uncooked|raw|dry|weighed|just|had|i|about|approx|approximately|g|grams?|grammes?|kg|ml|tbsps?|tsps?|tablespoons?|teaspoons?|spoon|spoons?|large|small|medium|extra|more|little|bit)\b/g;

/**
 * Matches an alias only on word boundaries. `includes()` would match "oil" inside "boiled"
 * and "chicken" inside a longer unrelated word.
 */
function findAlias(haystack: string, alias: string): number {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = haystack.match(new RegExp(`(?:^|[^a-z0-9])(${escaped})(?![a-z0-9])`));
  return match?.index === undefined ? -1 : match.index + match[0].length - alias.length;
}

export function parseFood(text: string): { items: ParsedFood[]; unknown: string[] } {
  const normalised = text.toLowerCase().replace(/perinaise/g, "peri mayonnaise");
  const found: ParsedFood[] = [];
  const occupied: Array<[number, number]> = [];
  // Everything the parser has accounted for gets blanked out; whatever survives is unknown.
  let residue = normalised;

  const blank = (start: number, end: number) => {
    residue = residue.slice(0, start) + " ".repeat(end - start) + residue.slice(end);
  };

  for (const food of FOODS) {
    let alias: string | undefined;
    let aliasIndex = -1;
    for (const candidate of food.aliases) {
      const index = findAlias(normalised, candidate);
      if (index === -1) continue;
      if (occupied.some(([start, end]) => index >= start && index < end)) continue;
      alias = candidate;
      aliasIndex = index;
      break;
    }
    if (!alias) continue;

    const aliasEnd = aliasIndex + alias.length;
    const before = normalised.slice(Math.max(0, aliasIndex - 42), aliasIndex);
    const after = normalised.slice(aliasEnd, aliasEnd + 32);
    // The basis word is captured, not just tolerated: a raw weighing of a cooked-basis food
    // has to be converted, and a missing alternative makes the whole gram match fail.
    const gramsBefore = before.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:g|grams?|grammes?)\\s*(?:of\\s*)?(?:(${BASIS})\\s*)?$`));
    // Joe writes the true weight in brackets after a count: "3 chicken thighs (392g uncooked)".
    const gramsAfter = after.match(new RegExp(`^[\\s,(]*(\\d+(?:\\.\\d+)?)\\s*(?:g|grams?|grammes?)\\s*(?:(${BASIS})\\s*)?\\)?`));
    const spoonBefore = before.match(new RegExp(`(?:^|\\s)(${COUNT})\\s*(tsps?|teaspoons?|tbsps?|tablespoons?)\\s*(?:of\\s*)?$`));
    const wordBefore = before.match(new RegExp(`(?:^|\\s)(${COUNT})\\s*(?:(?:${BASIS})\\s*)?$`));
    const count = wordBefore ? countOf(wordBefore[1]) : 1;

    // Priority: a weight Joe stated, then a spoon measure, then a count of portions. Only if
    // he gave none of those does the parser supply a quantity — and it says so.
    const stated = gramsBefore ?? gramsAfter;
    let grams: number;
    let assumed = false;
    if (stated) grams = Number(stated[1]);
    else if (spoonBefore) grams = countOf(spoonBefore[1]) * spoonGrams(food, spoonBefore[2]);
    else if (food.portionGrams) grams = food.portionGrams * count;
    else grams = 100;
    if (!stated && !spoonBefore && !wordBefore) assumed = true;

    const weighedRaw = isRaw(stated?.[2]) || new RegExp(`\\b(raw|uncooked)\\s*$`).test(before);
    const fromRawGrams = weighedRaw && food.rawYield ? grams : undefined;
    if (fromRawGrams !== undefined) grams = grams * food.rawYield!;

    found.push({
      ...scaled(food, grams),
      ...(fromRawGrams === undefined ? {} : { fromRawGrams }),
      ...(assumed ? { assumed: true } : {}),
    });
    occupied.push([aliasIndex, aliasEnd]);

    blank(aliasIndex, aliasEnd);
    if (gramsBefore) blank(aliasIndex - gramsBefore[0].length, aliasIndex);
    if (spoonBefore) blank(aliasIndex - spoonBefore[0].length, aliasIndex);
    if (wordBefore) blank(aliasIndex - wordBefore[0].length, aliasIndex);
    if (gramsAfter) blank(aliasEnd, aliasEnd + gramsAfter[0].length);
  }

  const unknown = residue
    .split(/[,;.]|\band\b|\bwith\b|\bplus\b/)
    .map((segment) => segment.replace(/\d+(?:\.\d+)?/g, " ").replace(FILLER, " ").replace(/\s+/g, " ").trim())
    .filter((segment) => /[a-z]{3}/.test(segment));

  return { items: found, unknown };
}
