export type Macros = { calories: number; protein: number; carbs: number; fat: number; fibre: number };
/**
 * Cooking changes a food's mass, so a weight only means something alongside the state it was
 * weighed in. `weighedAs` says which state the stored macros describe and `cookedRatio` is
 * always cooked mass ÷ uncooked mass — meat loses water (chicken 0.72), pasta gains it (2.25).
 *
 * Both directions matter, and they are not symmetric: 392g of uncooked chicken is *less* food
 * than 392g cooked, while 225g of cooked pasta is *less* food than 225g dry.
 */
/**
 * Where a food's numbers came from. Present means the macros were read off the Sainsbury's
 * product page named here; `basis` is that page's own wording, because "per 100g" means
 * different things for a raw pack and a cooked-as-instructed one.
 *
 * **Absent means the numbers are an unverified estimate** — Sainsbury's lists the product Joe
 * buys but publishes no nutrition table for it. Those are called out in README.md; never
 * quietly fill one in from a similar product.
 */
export type FoodSource = { product: string; url: string; basis: string };
export type CookState = "cooked" | "uncooked";
export type Food = Macros & { id: string; name: string; aliases: string[]; basis: "100g" | "portion"; portionGrams?: number; portionLabel?: string; portionVaries?: boolean; weighedAs?: CookState; cookedRatio?: number; source?: FoodSource; provisional?: boolean; fibreUnknown?: boolean };

/**
 * Convert a weight Joe took in one state into the state the food's macros are stored in.
 * Returns the weight unchanged when he did not say, or when he weighed it the same way the
 * label did — guessing a state is how a plate silently doubles.
 */
export function toStoredGrams(food: Food, grams: number, weighedAs?: CookState): number {
  if (!weighedAs || !food.weighedAs || !food.cookedRatio || weighedAs === food.weighedAs) return grams;
  return food.weighedAs === "cooked" ? grams * food.cookedRatio : grams / food.cookedRatio;
}
/**
 * `assumed` marks a gram figure the app supplied rather than read off what Joe said.
 *
 * - `"quantity"` — he named the food and no amount at all.
 * - `"portionSize"` — he counted items, but what one item weighs is a guess. Counting three
 *   thighs states a count, not a weight; Sainsbury's own pack notes "thigh fillet sizes also
 *   vary" and lists no serving count, so there is nothing to source it from.
 *
 * Both must be visible. An invented number that renders like a measured one is indistinguishable
 * from a correct answer at exactly the moment it is wrong.
 */
export type Assumption = "quantity" | "portionSize";
export type ParsedFood = Macros & { id: string; name: string; grams: number; display: string; weighedGrams?: number; weighedAs?: CookState; assumed?: Assumption };

const sainsburys = (product: string, slug: string, basis: string): FoodSource => ({
  product,
  url: `https://www.sainsburys.co.uk/gol-ui/product/${slug}`,
  basis,
});

/**
 * Macros come off the Sainsbury's product page for the thing Joe actually buys — see `source`
 * on each entry. Two conventions worth knowing:
 *
 * - UK labels report *available* carbohydrate, with fibre listed separately rather than
 *   included. American figures for the same food look carb-heavier; do not mix the two.
 * - A label reading "<0.5g" is recorded as 0. It is a detection floor, not a measurement,
 *   and carrying 0.5g across every meat portion would quietly inflate a day's carbs.
 *
 * Entries without a `source` are estimates carried over from the original build: Sainsbury's
 * sells the product but publishes no nutrition table for it. They are listed in README.md.
 */
export const FOODS: Food[] = [
  // 64g a thigh is a guess, not a label figure: the Sainsbury's pack says "thigh fillet sizes
  // also vary" and lists no serving count. Counting thighs therefore states a count, not a
  // weight, and `portionVaries` makes the app say so instead of implying it was measured.
  { id: "chicken-thigh", name: "Cooked chicken thighs", aliases: ["chicken thighs", "chicken thigh", "cooked chicken", "chicken"], basis: "100g", portionGrams: 64, portionLabel: "thigh", portionVaries: true, weighedAs: "cooked", cookedRatio: 0.72, calories: 168, protein: 24.8, carbs: 0, fat: 7.6, fibre: 0,
    source: sainsburys("Sainsbury's 640g British Fresh Skinless & Boneless Chicken Thigh Fillets", "sainsburys-640g-british-fresh-skinless-boneless-chicken-thigh-fillets", "per 100g, cooked as per instructions") },
  { id: "mince", name: "Cooked 5% beef mince", aliases: ["5% mince", "five percent mince", "beef mince", "mince meat", "mince"], basis: "100g", weighedAs: "cooked", cookedRatio: 0.7, calories: 168, protein: 31, carbs: 0, fat: 4.7, fibre: 0,
    source: sainsburys("Sainsbury's British or Irish Beef Mince 1kg", "sainsburys-british-or-irish-beef-mince-1kg", "per 100g; the label omits the basis, but 31g protein is a cooked figure") },
  { id: "steak", name: "Cooked sirloin steak", aliases: ["sirloin steak", "steak"], basis: "100g", weighedAs: "cooked", cookedRatio: 0.75, calories: 189, protein: 27.7, carbs: 0, fat: 8.7, fibre: 0,
    source: sainsburys("Sainsbury's 30 Days Matured British Beef Sirloin Steak, Taste the Difference 225g", "sainsburys-30-days-matured-british-beef-sirloin-steak-taste-the-difference-225g", "per 100g, cooked as per instructions") },
  { id: "salmon", name: "Cooked salmon", aliases: ["salmon fillets", "salmon fillet", "salmon"], basis: "100g", weighedAs: "cooked", cookedRatio: 0.8, calories: 247, protein: 24.1, carbs: 0, fat: 16.4, fibre: 0,
    source: sainsburys("Sainsbury's Skin on ASC lightly Smoked Scottish Salmon Fillets, Taste the Difference x2 240g", "sainsburys-skin-on-asc-lightly-smoked-scottish-salmon-fillets-taste-the-difference-x2-240g", "per 100g, pan fried") },
  // Sainsbury's own listing for the Veetee pots carries no table, so these come from the
  // packaging as transcribed on Open Food Facts. Both agreed to the decimal with the figures
  // already in the app, which is the corroboration that makes a community source usable here.
  { id: "sticky-rice", name: "Veetee sticky rice pot", aliases: ["veetee sticky rice", "vt sticky rice", "sticky rice pot", "sticky rice", "veetee cooked rice", "vt cooked rice", "veetee rice pot", "vt rice pot", "veetee rice", "vt rice"], basis: "portion", portionGrams: 130, portionLabel: "pot", calories: 198, protein: 3, carbs: 41.2, fat: 2.3, fibre: 0,
    source: { product: "Veetee Heat & Eat Sticky Rice Pot", url: "https://uk-gd.openfoodfacts.org/product/5016805010255/sticky-rice-veetee", basis: "per 100g (152kcal 2.3P 31.7C 1.8F), scaled to the 130g pot the label names; fibre is not published" } },
  { id: "jasmine-rice", name: "Veetee jasmine rice pot", aliases: ["veetee jasmine rice", "vt jasmine rice", "jasmine rice pot", "jasmine rice"], basis: "portion", portionGrams: 140, portionLabel: "pot", calories: 202, protein: 4.1, carbs: 40.7, fat: 2.1, fibre: 1.7,
    source: { product: "Veetee Heat & Eat Thai Jasmine Rice Pot", url: "https://world.openfoodfacts.org/product/5016805010217/veetee-thai-jasmine-rice", basis: "per 100g (144kcal 2.9P 29.1C 1.5F 1.2fib), scaled to the 140g pot the label names" } },
  // His bag publishes its table cooked, not dry, so that is what is stored. 100g dry scales up
  // through cookedRatio to 225g cooked, the ratio Joe gave himself.
  { id: "pasta", name: "Cooked fusilli pasta", aliases: ["fusilli pasta", "dry pasta", "pasta"], basis: "100g", weighedAs: "cooked", cookedRatio: 2.25, calories: 164, protein: 5.5, carbs: 33.2, fat: 0.7, fibre: 1.5,
    source: sainsburys("Sainsbury's Fusilli Pasta 1kg", "sainsburys-fusilli-pasta-1kg", "per 100g cooked") },
  { id: "broccoli", name: "Broccoli", aliases: ["broccoli"], basis: "100g", calories: 35, protein: 3.3, carbs: 2.8, fat: 0.5, fibre: 2.8,
    source: sainsburys("Sainsbury's Broccoli Florets 900g", "sainsburys-broccoli-florets-900g", "per 100g, cooked as per instructions") },
  { id: "peppers", name: "Sweet peppers", aliases: ["sweet peppers", "bell peppers", "pepper", "peppers"], basis: "100g", calories: 23, protein: 0.8, carbs: 4.1, fat: 0.5, fibre: 1,
    source: sainsburys("Sainsbury's Sweet Peppers (Colours may vary) x3", "sainsburys-sweet-peppers-colours-may-vary-x3", "per 100g, raw") },
  { id: "spring-onions", name: "Spring onions", aliases: ["spring onions", "spring onion"], basis: "100g", calories: 27, protein: 2, carbs: 2.9, fat: 0.5, fibre: 1.5,
    source: sainsburys("Sainsbury's Spring Onions Bunch 100g", "sainsburys-spring-onions-bunch-100g", "per 100g") },
  { id: "avocado", name: "Avocado", aliases: ["avocado"], basis: "100g", calories: 197, protein: 1.9, carbs: 1.9, fat: 19.5, fibre: 3.4,
    source: sainsburys("Sainsbury's Medium Ripe & Ready Avocados, SO Organic x2", "sainsburys-medium-ripe-ready-avocados-so-organic-x2", "per 100g") },
  // Sainsbury's own Greek Feta shows no table; Attis is the stocked block that publishes one.
  { id: "feta", name: "Feta", aliases: ["feta cheese", "feta"], basis: "100g", calories: 276, protein: 16.5, carbs: 0.7, fat: 23, fibre: 0,
    source: sainsburys("Sainsbury's Greek Feta Cheese 200g", "sainsburys-greek-feta-cheese-200g", "per 100g") },
  // Condiments carry a portion size so an unquantified mention costs a spoonful rather than
  // the 100g fallback — 100g of pesto is 451 kcal, which quietly wrecks a day's numbers.
  { id: "pesto", name: "Green pesto", aliases: ["green pesto", "pesto"], basis: "100g", portionGrams: 15, portionLabel: "tbsp", calories: 312, protein: 4.3, carbs: 8.4, fat: 28.4, fibre: 3,
    source: sainsburys("Sainsbury's Green Pesto 190g", "sainsburys-green-pesto-190g", "per 100g; the jar's own serving is 1/4 jar (47.5g), but a tbsp is the useful unit here") },
  // Straight off McCain's own site, which publishes frozen and oven-baked columns side by side.
  // Some retailer listings show 257kcal; the manufacturer's 270 is the one to trust, and it is
  // the oven-baked column that matches how Joe eats them.
  { id: "chips", name: "Oven chips", aliases: ["gastro chips", "oven chips", "chips"], basis: "100g", weighedAs: "cooked", cookedRatio: 0.615, calories: 270, protein: 3.1, carbs: 33.2, fat: 13.2, fibre: 2.9,
    source: { product: "McCain Gastro Triple Cooked Chips", url: "https://www.mccain.co.uk/gastro-triple-cooked-chips/", basis: "per 100g oven baked; frozen is 166kcal 1.7P 21.8C 7.7F 1.2fib, hence the 0.615 cooked ratio" } },
  { id: "nandos", name: "Nando's PERi-PERi sauce", aliases: ["nando's hot sauce", "nandos hot sauce", "nando sauce", "nandos sauce", "peri-peri sauce", "peri peri sauce"], basis: "portion", portionGrams: 20, portionLabel: "serving", calories: 9.8, protein: 0.1, carbs: 0.3, fat: 0.8, fibre: 0,
    source: sainsburys("Nando's Peri Peri Sauce Medium 125g", "nando-s-peri-peri-sauce-medium-125g", "per 100g (49kcal 0.6P 1.4C 4.2F), scaled to the 20g serving; fibre is not published") },
  // Not a packaged product, so the source is a reference table rather than a label. Black
  // coffee is close enough to nothing that the point is being able to log it at all.
  { id: "coffee", name: "Black coffee", aliases: ["black coffee", "americano", "espresso", "coffee"], basis: "portion", portionGrams: 240, portionLabel: "mug", calories: 2.4, protein: 0.3, carbs: 0, fat: 0, fibre: 0,
    source: { product: "Brewed coffee (USDA food code 92101000)", url: "https://www.nutritionvalue.org/Coffee%2C_brewed_92101000_nutritional_value.html", basis: "per 100g (1kcal 0.13P), scaled to a 240ml mug" } },
  { id: "kefir", name: "Strawberry kefir", aliases: ["strawberry kefir", "activia kefir", "kefir"], basis: "portion", portionGrams: 280, portionLabel: "bottle", calories: 201.6, protein: 8.7, carbs: 22.1, fat: 8.7, fibre: 0,
    source: sainsburys("Activia 280g Strawberry Kefir", "activia-280g-strawberry-kefir", "per 100g (72kcal 3.1P 7.9C 3.1F), scaled to the 280g bottle; fibre is not published") },
  { id: "protein-yogurt", name: "High-protein yoghurt", aliases: ["high protein yoghurt", "high protein yogurt", "protein yoghurt", "protein yogurt"], basis: "100g", calories: 72, protein: 10, carbs: 6.6, fat: 0.2, fibre: 0,
    source: sainsburys("Arla Protein Strawberry Yogurt 200g", "arla-protein-strawberry-yogurt-200g", "per 100g; fibre is not published") },
  { id: "protein-bagel", name: "Protein bagel", aliases: ["protein boost bagel", "protein bagel", "bagel"], basis: "portion", portionGrams: 68, portionLabel: "bagel", calories: 202, protein: 10.6, carbs: 26.5, fat: 5, fibre: 4.4,
    source: sainsburys("New York Bakery Sliced Protein Boost NYC Bagels", "new-york-bakery-sliced-protein-boost-nyc-bagels", "per 100g, taken from the per-bagel column; the label states 1 serving = 1 bagel (68g)") },
  { id: "peanut-butter", name: "Peanut butter", aliases: ["smooth peanut butter", "peanut butter"], basis: "100g", portionGrams: 15, portionLabel: "serving", calories: 624, protein: 24.6, carbs: 13.7, fat: 50.9, fibre: 6.4,
    source: sainsburys("Sainsbury's Peanut Butter Smooth 340g", "sainsburys-peanut-butter-smooth-340g", "per 100g") },
  { id: "veggie-cakes", name: "Beetroot veggie cakes", aliases: ["beetroot and balsamic veggie cakes", "beetroot veggie cakes", "veggie cakes", "rice cakes"], basis: "portion", portionGrams: 9.38, portionLabel: "cake", calories: 39.8, protein: 2.3, carbs: 4.8, fat: 1.1, fibre: 0.6,
    source: sainsburys("Kallo Beetroot Veggie Cake 122g", "kallo-beetrooot-veggie-cake-122g", "per 100g (424kcal 25P 51C 12F 6fib), scaled to the 9.38g cake") },
  // Cooking fats sit last on purpose: their short aliases ("oil", "butter") would otherwise
  // shadow longer names that contain them, e.g. "peanut butter".
  // The headline figures are per 100ml, which is useless for a food Joe weighs. The label's
  // per-tablespoon column is mass-based though — 123 kcal and 13.7g fat — and since the oil is
  // essentially all fat that tablespoon weighs 13.7g, giving 123/13.7 = 898 kcal per 100g.
  { id: "olive-oil", name: "Olive oil", aliases: ["extra virgin olive oil", "olive oil", "vegetable oil", "rapeseed oil", "cooking oil", "oil"], basis: "100g", portionGrams: 13.7, portionLabel: "tbsp", calories: 898, protein: 0, carbs: 0, fat: 100, fibre: 0,
    source: sainsburys("Sainsbury's Olive Oil, Extra Virgin 1L", "sainsburys-olive-oil-extra-virgin-1l", "per 100g, derived from the label's per-tablespoon column (123kcal / 13.7g fat)") },
  { id: "butter", name: "Butter", aliases: ["salted butter", "unsalted butter", "butter"], basis: "100g", portionGrams: 10, portionLabel: "knob", calories: 744, protein: 0.6, carbs: 0.6, fat: 82, fibre: 0,
    source: sainsburys("Anchor Salted Butter 200g", "anchor-salted-butter-200g", "per 100g") },
];

const numberWords: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };
const round = (value: number, places = 0) => Number(value.toFixed(places));

/** Numerals count as much as number words — Joe types "3 chicken thighs" as often as "three". */
const COUNT = "\\d+(?:\\.\\d+)?|a|an|one|two|three|four";
const countOf = (token: string) => (token in numberWords ? numberWords[token] : Number(token));

/** "cooked" is a prefix of "uncooked", so the longer word has to be tried first. */
const BASIS = "uncooked|cooked|raw|dry";
const cookStateOf = (word?: string): CookState | undefined => {
  if (word === "raw" || word === "uncooked" || word === "dry") return "uncooked";
  return word === "cooked" ? "cooked" : undefined;
};

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
  /\b(a|an|one|two|three|four|and|with|plus|of|some|the|my|then|also|served|side|sides|bowl|plate|portion|portions|cooked|uncooked|raw|dry|weighed|just|had|ate|eaten|eating|having|made|i|about|approx|approximately|g|grams?|grammes?|kg|ml|tbsps?|tsps?|tablespoons?|teaspoons?|spoon|spoons?|large|small|medium|extra|more|little|bit|pots?|tubs?|jars?|tins?|packs?|punnets?|knobs?|servings?|slices?|handfuls?|drizzle|splash|pinch)\b/g;

/**
 * Matches an alias only on word boundaries. `includes()` would match "oil" inside "boiled"
 * and "chicken" inside a longer unrelated word.
 */
export function findAlias(haystack: string, alias: string): number {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = haystack.match(new RegExp(`(?:^|[^a-z0-9])(${escaped})(?![a-z0-9])`));
  return match?.index === undefined ? -1 : match.index + match[0].length - alias.length;
}

export function parseFood(text: string, extra: Food[] = []): { items: ParsedFood[]; unknown: string[] } {
  // Brackets become spaces rather than being stripped, so every index still lines up with the
  // original text. Joe puts the real weight in brackets on either side of the food — "3
  // uncooked (392g) chicken thighs", "some pesto (2 teaspoons)" — and once they are spaces
  // those read exactly like the unbracketed forms, so one set of rules covers both.
  const normalised = text.toLowerCase().replace(/perinaise/g, "peri mayonnaise").replace(/[()[\]]/g, " ");
  const found: ParsedFood[] = [];
  const occupied: Array<[number, number]> = [];
  // Everything the parser has accounted for gets blanked out; whatever survives is unknown.
  let residue = normalised;

  const blank = (start: number, end: number) => {
    residue = residue.slice(0, start) + " ".repeat(end - start) + residue.slice(end);
  };

  // Scanned foods go first, so a product Joe has actually scanned wins the name over a generic
  // stored entry — his salmon rather than the app's idea of salmon. `FOODS`' own ordering is
  // unchanged behind them, so the cooking fats still sit last among the stocked foods.
  for (const food of [...extra, ...FOODS]) {
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
    // The basis word sits on either side of the number: "392g raw" and "uncooked 392g" are the
    // same claim, and before the brackets became spaces only the first form parsed.
    const gramsBefore = before.match(new RegExp(`(?:(${BASIS})\\s+)?(\\d+(?:\\.\\d+)?)\\s*(?:g|grams?|grammes?)\\s*(?:of\\s*)?(?:(${BASIS})\\s*)?$`));
    // Scanning forward must not cross a comma. "chicken thighs, 100g pasta" gave the chicken
    // the pasta's weight — every number was real, and the meal was still wrong.
    const gramsAfter = after.match(new RegExp(`^\\s*(\\d+(?:\\.\\d+)?)\\s*(?:g|grams?|grammes?)\\s*(?:(${BASIS})\\s*)?`));
    const SPOON = "tsps?|teaspoons?|tbsps?|tablespoons?";
    const spoonBefore = before.match(new RegExp(`(?:^|\\s)(${COUNT})\\s*(${SPOON})\\s*(?:of\\s*)?$`));
    const spoonAfter = after.match(new RegExp(`^\\s*(${COUNT})\\s*(${SPOON})`));
    const wordBefore = before.match(new RegExp(`(?:^|\\s)(${COUNT})\\s*(?:(?:${BASIS})\\s*)?$`));
    const count = wordBefore ? countOf(wordBefore[1]) : 1;

    // Priority: a weight Joe stated, then a spoon measure, then a count of portions. Only if
    // he gave none of those does the parser supply a quantity — and it says so.
    // gramsBefore captures the basis on both sides of the number, so its number is group 2.
    const stated = gramsBefore
      ? { grams: Number(gramsBefore[2]), basis: gramsBefore[1] ?? gramsBefore[3] }
      : gramsAfter
        ? { grams: Number(gramsAfter[1]), basis: gramsAfter[2] }
        : null;
    const spoon = spoonBefore ?? spoonAfter;

    let grams: number;
    let assumed: Assumption | undefined;
    if (stated) grams = stated.grams;
    else if (spoon) grams = countOf(spoon[1]) * spoonGrams(food, spoon[2]);
    else if (food.portionGrams) grams = food.portionGrams * count;
    else grams = 100;
    // A count is a stated quantity, but for a food whose pieces vary the *weight* of one is
    // still the app's guess, and that is where "3 thighs" quietly becomes a number.
    //
    // A portion-basis food is sold and eaten as whole units, so a bare "bagel" plainly means
    // one bagel — that is reading Joe, not guessing at him. Only foods normally measured by
    // weight (peanut butter, pesto) have no natural amount to fall back on.
    const counted = Boolean(wordBefore) || food.basis === "portion";
    if (!stated && !spoon) assumed = counted ? (food.portionVaries ? "portionSize" : undefined) : "quantity";

    // Joe weighs things as they come out of the packet or the bag, so a weight he gives without
    // saying which is an uncooked one. This has to be a default rather than a no-op: his pasta
    // is stored on a cooked basis, and reading "100g pasta" as 100g cooked would log a third of
    // what he is about to eat. The conversion shows on the chip, so a wrong guess is visible.
    const explicit = cookStateOf(stated?.basis) ?? cookStateOf(before.match(new RegExp(`\\b(${BASIS})\\s*$`))?.[1]);
    const weighedAs = explicit ?? (stated && food.cookedRatio ? "uncooked" : undefined);
    const storedGrams = toStoredGrams(food, grams, weighedAs);
    const converted = storedGrams !== grams;

    found.push({
      ...scaled(food, storedGrams),
      ...(converted ? { weighedGrams: grams, weighedAs } : {}),
      ...(assumed ? { assumed } : {}),
    });
    occupied.push([aliasIndex, aliasEnd]);

    blank(aliasIndex, aliasEnd);
    if (gramsBefore) blank(aliasIndex - gramsBefore[0].length, aliasIndex);
    if (spoonBefore) blank(aliasIndex - spoonBefore[0].length, aliasIndex);
    if (wordBefore) blank(aliasIndex - wordBefore[0].length, aliasIndex);
    if (gramsAfter) blank(aliasEnd, aliasEnd + gramsAfter[0].length);
    if (spoonAfter) blank(aliasEnd, aliasEnd + spoonAfter[0].length);
  }

  const unknown = residue
    .split(/[,;.]|\band\b|\bwith\b|\bplus\b/)
    .map((segment) => segment.replace(/\d+(?:\.\d+)?/g, " ").replace(FILLER, " ").replace(/\s+/g, " ").trim())
    .filter((segment) => /[a-z]{3}/.test(segment));

  return { items: found, unknown };
}
