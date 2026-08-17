export type Macros = { calories: number; protein: number; carbs: number; fat: number; fibre: number };
export type Food = Macros & { id: string; name: string; aliases: string[]; basis: "100g" | "portion"; portionGrams?: number; portionLabel?: string };
export type ParsedFood = Macros & { id: string; name: string; grams: number; display: string };

export const FOODS: Food[] = [
  { id: "chicken-thigh", name: "Cooked chicken thighs", aliases: ["chicken thighs", "chicken thigh", "cooked chicken", "chicken"], basis: "100g", portionGrams: 64, portionLabel: "thigh", calories: 168, protein: 24.8, carbs: 0, fat: 7.6, fibre: 0 },
  { id: "mince", name: "Cooked 5% beef mince", aliases: ["5% mince", "five percent mince", "beef mince", "mince meat", "mince"], basis: "100g", calories: 168, protein: 31, carbs: 0, fat: 4.7, fibre: 0 },
  { id: "steak", name: "Cooked sirloin steak", aliases: ["sirloin steak", "steak"], basis: "100g", calories: 189, protein: 27.7, carbs: 0, fat: 8.7, fibre: 0 },
  { id: "salmon", name: "Cooked salmon", aliases: ["salmon fillets", "salmon fillet", "salmon"], basis: "100g", calories: 247, protein: 24.1, carbs: 0, fat: 16.4, fibre: 0 },
  { id: "sticky-rice", name: "Veetee sticky rice pot", aliases: ["veetee sticky rice", "vt sticky rice", "sticky rice pot", "sticky rice", "veetee cooked rice", "vt cooked rice", "veetee rice pot", "vt rice pot", "veetee rice", "vt rice"], basis: "portion", portionGrams: 130, portionLabel: "pot", calories: 198, protein: 3, carbs: 41.2, fat: 2.3, fibre: 0 },
  { id: "jasmine-rice", name: "Veetee jasmine rice pot", aliases: ["veetee jasmine rice", "vt jasmine rice", "jasmine rice pot", "jasmine rice"], basis: "portion", portionGrams: 140, portionLabel: "pot", calories: 202, protein: 4.1, carbs: 40.7, fat: 2.1, fibre: 1.7 },
  { id: "pasta", name: "Dry fusilli pasta", aliases: ["fusilli pasta", "dry pasta", "pasta"], basis: "100g", calories: 359, protein: 12, carbs: 72, fat: 1.5, fibre: 3.5 },
  { id: "broccoli", name: "Broccoli", aliases: ["broccoli"], basis: "100g", calories: 35, protein: 2.4, carbs: 4.4, fat: 0.4, fibre: 3.3 },
  { id: "peppers", name: "Sweet peppers", aliases: ["sweet peppers", "bell peppers", "pepper", "peppers"], basis: "100g", calories: 27, protein: 1, carbs: 5.3, fat: 0.3, fibre: 1.8 },
  { id: "avocado", name: "Avocado", aliases: ["avocado"], basis: "100g", calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fibre: 6.7 },
  { id: "feta", name: "Feta", aliases: ["feta cheese", "feta"], basis: "100g", calories: 276, protein: 14.2, carbs: 0.8, fat: 23, fibre: 0 },
  { id: "pesto", name: "Green pesto", aliases: ["green pesto", "pesto"], basis: "100g", calories: 455, protein: 4.7, carbs: 5.6, fat: 46.1, fibre: 1 },
  { id: "chips", name: "Oven chips", aliases: ["gastro chips", "oven chips", "chips"], basis: "100g", calories: 236, protein: 3.3, carbs: 31.6, fat: 10.4, fibre: 3.3 },
  { id: "nandos", name: "Nando's PERi-PERi sauce", aliases: ["nando's hot sauce", "nandos hot sauce", "nando sauce", "nandos sauce", "peri-peri sauce", "peri peri sauce"], basis: "portion", portionGrams: 20, portionLabel: "serving", calories: 9, protein: 0.2, carbs: 0.5, fat: 0.5, fibre: 0.3 },
  { id: "protein-yogurt", name: "High-protein yoghurt", aliases: ["high protein yoghurt", "high protein yogurt", "protein yoghurt", "protein yogurt"], basis: "100g", calories: 73, protein: 10, carbs: 5.1, fat: 0.8, fibre: 0 },
  { id: "protein-bagel", name: "Protein bagel", aliases: ["protein boost bagel", "protein bagel", "bagel"], basis: "portion", portionGrams: 68, portionLabel: "bagel", calories: 194, protein: 10.6, carbs: 26.5, fat: 5, fibre: 4.4 },
  { id: "peanut-butter", name: "Peanut butter", aliases: ["smooth peanut butter", "peanut butter"], basis: "100g", portionGrams: 15, portionLabel: "serving", calories: 606, protein: 26, carbs: 16, fat: 47, fibre: 8.1 },
  { id: "veggie-cakes", name: "Beetroot veggie cakes", aliases: ["beetroot and balsamic veggie cakes", "beetroot veggie cakes", "veggie cakes", "rice cakes"], basis: "portion", portionGrams: 9.38, portionLabel: "cake", calories: 40, protein: 2.4, carbs: 4.8, fat: 1.1, fibre: 0.6 },
];

const numberWords: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };
const round = (value: number, places = 0) => Number(value.toFixed(places));

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

export function parseFood(text: string): { items: ParsedFood[]; unknown: string[] } {
  const normalised = text.toLowerCase().replace(/perinaise/g, "peri mayonnaise");
  const found: ParsedFood[] = [];
  const occupied: Array<[number, number]> = [];

  for (const food of FOODS) {
    const alias = food.aliases.find((candidate) => normalised.includes(candidate));
    if (!alias) continue;
    const aliasIndex = normalised.indexOf(alias);
    if (occupied.some(([start, end]) => aliasIndex >= start && aliasIndex < end)) continue;
    const before = normalised.slice(Math.max(0, aliasIndex - 42), aliasIndex);
    const after = normalised.slice(aliasIndex + alias.length, aliasIndex + alias.length + 28);
    const gramsBefore = before.match(/(\d+(?:\.\d+)?)\s*(?:g|grams?|grammes?)\s*(?:of\s*)?(?:cooked\s*)?$/);
    const gramsAfter = after.match(/^\s*(\d+(?:\.\d+)?)\s*(?:g|grams?|grammes?)/);
    const wordBefore = before.match(/(?:^|\s)(a|an|one|two|three|four)\s*(?:cooked\s*)?$/);
    const count = wordBefore ? numberWords[wordBefore[1]] : 1;
    let grams = gramsBefore ? Number(gramsBefore[1]) : gramsAfter ? Number(gramsAfter[1]) : food.portionGrams || 100;
    if (!gramsBefore && !gramsAfter && food.portionGrams) grams *= count;
    found.push(scaled(food, grams));
    occupied.push([aliasIndex, aliasIndex + alias.length]);
  }

  return { items: found, unknown: found.length ? [] : [text] };
}
