"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Macros = { calories: number; protein: number; carbs: number; fat: number; fibre: number };
type Food = Macros & { id: string; name: string; aliases: string[]; basis: "100g" | "portion"; portionGrams?: number; portionLabel?: string };
type ParsedFood = Macros & { id: string; name: string; grams: number; display: string };
type Meal = { id: string; name: string; text: string; time: string; items: ParsedFood[]; macros: Macros };
type Diary = Record<string, Meal[]>;

const TARGETS: Macros = { calories: 1800, protein: 160, carbs: 155, fat: 60, fibre: 30 };
const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };
const CALORIE_SPLIT = [
  { label: "Protein", grams: 160, calories: 640, percent: 35.6, color: "#b7d94c" },
  { label: "Carbs", grams: 155, calories: 620, percent: 34.4, color: "#7184df" },
  { label: "Fat", grams: 60, calories: 540, percent: 30, color: "#ed9863" },
];

const FOODS: Food[] = [
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
];

const numberWords: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };
const addMacros = (a: Macros, b: Macros): Macros => ({ calories: a.calories + b.calories, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat, fibre: a.fibre + b.fibre });
const round = (value: number, places = 0) => Number(value.toFixed(places));
const dateKey = (date = new Date()) => date.toLocaleDateString("en-CA");
const longDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00`));

function scaled(food: Food, grams: number): ParsedFood {
  const factor = food.basis === "100g" ? grams / 100 : grams / (food.portionGrams || grams);
  return {
    id: food.id,
    name: food.name,
    grams,
    display: food.basis === "portion" && grams === food.portionGrams ? `1 ${food.portionLabel}` : `${round(grams)}g`,
    calories: food.calories * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
    fibre: food.fibre * factor,
  };
}

function parseFood(text: string): { items: ParsedFood[]; unknown: string[] } {
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
    const gramsAfter = after.match(/^[^,\d]{0,20}(\d+(?:\.\d+)?)\s*(?:g|grams?|grammes?)/);
    const wordBefore = before.match(/(?:^|\s)(a|an|one|two|three|four)\s*(?:cooked\s*)?$/);
    const count = wordBefore ? numberWords[wordBefore[1]] : 1;
    let grams = gramsBefore ? Number(gramsBefore[1]) : gramsAfter ? Number(gramsAfter[1]) : food.portionGrams || 100;
    if (!gramsBefore && !gramsAfter && food.portionGrams) grams *= count;
    found.push(scaled(food, grams));
    occupied.push([aliasIndex, aliasIndex + alias.length]);
  }

  return { items: found, unknown: found.length ? [] : [text] };
}

function total(items: ParsedFood[] | Meal[]): Macros {
  return items.reduce((sum, item) => addMacros(sum, "macros" in item ? item.macros : item), ZERO);
}

function seedMeal(): Meal {
  const items = [scaled(FOODS[0], 192), scaled(FOODS[4], 130), scaled(FOODS[13], 20)];
  return { id: "monday-lunch", name: "Lunch", text: "192g cooked chicken, one Veetee sticky rice pot and Nando's sauce", time: "12:30", items, macros: total(items) };
}

function coachMessage(consumed: Macros, preview?: Macros) {
  const projected = preview ? addMacros(consumed, preview) : consumed;
  const over = (["calories", "carbs", "fat"] as const).filter((key) => projected[key] > TARGETS[key]);
  if (preview && over.length) {
    const detail = over.map((key) => `${round(projected[key] - TARGETS[key], key === "calories" ? 0 : 1)}${key === "calories" ? " kcal" : "g"} over ${key}`).join(" and ");
    return { tone: "warn", title: "Adjust this before eating.", body: `This meal would take you ${detail}. Reduce that portion or choose a leaner swap.` };
  }
  if (preview) {
    return { tone: "good", title: "This meal fits today.", body: `After it, you would have ${Math.max(0, round(TARGETS.calories - projected.calories))} kcal and ${Math.max(0, round(TARGETS.protein - projected.protein))}g protein remaining.` };
  }
  const proteinLeft = Math.max(0, TARGETS.protein - consumed.protein);
  const fibreLeft = Math.max(0, TARGETS.fibre - consumed.fibre);
  if (consumed.calories === 0) return { tone: "neutral", title: "Ready when you are.", body: "Speak or type your first meal and I’ll work out what fits next." };
  if (fibreLeft > 15) return { tone: "neutral", title: "Good start. Prioritise fibre next.", body: `Add broccoli and peppers. You still need about ${round(proteinLeft)}g protein and ${round(fibreLeft)}g fibre today.` };
  if (proteinLeft > 45) return { tone: "neutral", title: "Make the next meal protein-led.", body: `You still need about ${round(proteinLeft)}g protein. Chicken, mince or a high-protein yoghurt would fit.` };
  return { tone: "good", title: "You’re closing in on today’s goals.", body: `${round(proteinLeft)}g protein and ${round(fibreLeft)}g fibre remain.` };
}

function MacroLine({ label, value, target, color, note }: { label: string; value: number; target: number; color: string; note: string }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  const left = target - value;
  return (
    <article className={`macro-line ${left < 0 ? "over" : ""}`} style={{ "--accent": color, "--fill": `${pct}%` } as React.CSSProperties}>
      <div className="macro-name"><span className="split-dot" /><strong>{label}</strong><small>{note}</small></div>
      <div className="macro-track"><span /></div>
      <div className="macro-value"><strong>{round(value, 1)}</strong><span> / {target}g</span></div>
      <div className="macro-left">{left >= 0 ? `${round(left, 1)}g left` : `${round(Math.abs(left), 1)}g over`}</div>
    </article>
  );
}

export default function Home() {
  const today = useMemo(() => dateKey(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [diary, setDiary] = useState<Diary>({});
  const [hydrated, setHydrated] = useState(false);
  const [entry, setEntry] = useState("");
  const [previewItems, setPreviewItems] = useState<ParsedFood[]>([]);
  const [parseError, setParseError] = useState("");
  const [listening, setListening] = useState(false);
  const [mealName, setMealName] = useState("Lunch");
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("joe-gym-diary-v1");
    if (saved) {
      try { setDiary(JSON.parse(saved)); } catch { setDiary({ [today]: [seedMeal()] }); }
    } else {
      setDiary({ [today]: [seedMeal()] });
    }
    setHydrated(true);
  }, [today]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem("joe-gym-diary-v1", JSON.stringify(diary));
  }, [diary, hydrated]);

  const meals = diary[selectedDate] || [];
  const consumed = total(meals);
  const previewMacros = total(previewItems);
  const coach = coachMessage(consumed, previewItems.length ? previewMacros : undefined);
  const caloriePct = Math.min(100, Math.round((consumed.calories / TARGETS.calories) * 100));
  const proteinEnd = 128.16;
  const carbsEnd = 252;
  const proteinFill = proteinEnd * Math.min(1, consumed.protein / TARGETS.protein);
  const carbsFill = proteinEnd + (carbsEnd - proteinEnd) * Math.min(1, consumed.carbs / TARGETS.carbs);
  const fatFill = carbsEnd + (360 - carbsEnd) * Math.min(1, consumed.fat / TARGETS.fat);
  const wheelStyle = {
    "--protein-fill": `${proteinFill}deg`,
    "--carbs-fill": `${carbsFill}deg`,
    "--fat-fill": `${fatFill}deg`,
  } as React.CSSProperties;

  function previewEntry(event?: FormEvent) {
    event?.preventDefault();
    if (!entry.trim()) return;
    const parsed = parseFood(entry);
    if (!parsed.items.length) {
      setParseError("I couldn’t recognise that yet. Try: “200g cooked chicken, one sticky rice pot and 150g broccoli”.");
      setPreviewItems([]);
      return;
    }
    setParseError("");
    setPreviewItems(parsed.items);
  }

  function logMeal() {
    if (!previewItems.length) return;
    const now = new Date();
    const meal: Meal = {
      id: `${Date.now()}`,
      name: mealName,
      text: entry,
      time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      items: previewItems,
      macros: previewMacros,
    };
    setDiary((current) => ({ ...current, [selectedDate]: [...(current[selectedDate] || []), meal] }));
    setEntry("");
    setPreviewItems([]);
  }

  function removeMeal(id: string) {
    setDiary((current) => ({ ...current, [selectedDate]: (current[selectedDate] || []).filter((meal) => meal.id !== id) }));
  }

  function toggleVoice() {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const SpeechRecognition = (window as typeof window & { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }).SpeechRecognition
      || (window as typeof window & { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!SpeechRecognition) { setParseError("Voice entry isn’t supported in this browser. You can still type the meal below."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-GB";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => { setEntry(event.results[0][0].transcript); setListening(false); };
    recognition.onerror = () => { setListening(false); setParseError("I couldn’t hear that clearly. Please try again or type the meal."); };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  if (!hydrated) return <main className="loading">Loading Joe&apos;s dashboard…</main>;

  return (
    <main>
      <header className="topbar">
        <div className="brand-mark">JG</div>
        <div><p className="eyebrow">Joe&apos;s daily nutrition</p><h1>{longDate(selectedDate)}</h1></div>
        <label className="date-button">Day<input type="date" value={selectedDate} max={today} onChange={(event) => { setSelectedDate(event.target.value); setPreviewItems([]); }} /></label>
      </header>

      <section className="plate-section">
        <div className="plate-copy">
          <p className="eyebrow">Your 1,800 calorie split</p>
          <h2>The whole day,<br />in one circle.</h2>
          <div className="split-legend">
            {CALORIE_SPLIT.map((item) => (
              <div className="split-row" key={item.label}>
                <span className="split-dot" style={{ background: item.color }} />
                <strong>{item.label}</strong>
                <span>{item.grams}g</span>
                <span>{item.calories} kcal</span>
                <small>{item.percent}%</small>
              </div>
            ))}
          </div>
          <p className="fibre-note"><span>+</span> Fibre stays separate: <strong>{TARGETS.fibre}g minimum</strong></p>
        </div>
        <div className="wheel-wrap">
          <div className="nutrition-wheel" style={wheelStyle} aria-label={`Macro progress: ${round(consumed.protein, 1)} of 160 grams protein, ${round(consumed.carbs, 1)} of 155 grams carbohydrates, and ${round(consumed.fat, 1)} of 60 grams fat`}>
            <div className="wheel-target" aria-hidden="true" />
            <div className="wheel-progress" aria-hidden="true" />
            <div className="wheel-hole" aria-hidden="true" />
            <span className="wheel-spoke spoke-protein" aria-hidden="true" />
            <span className="wheel-spoke spoke-carbs" aria-hidden="true" />
            <span className="wheel-spoke spoke-fat" aria-hidden="true" />
            <div className="wheel-centre"><strong>{caloriePct}%</strong><span>eaten</span><small>{round(consumed.calories)} / 1,800 kcal</small></div>
          </div>
          <div className="remaining-kcal"><strong>{Math.abs(round(TARGETS.calories - consumed.calories))}</strong><span>kcal {consumed.calories <= TARGETS.calories ? "left" : "over"}</span></div>
        </div>
      </section>

      <article className={`coach-strip ${coach.tone}`}><span className="coach-dot">●</span><div><strong>{coach.title}</strong><p>{coach.body}</p></div></article>

      <section className="macro-section">
        <div className="section-heading"><div><p className="eyebrow">What remains</p><h2>Today&apos;s targets</h2></div><p className="muted">Live after every meal</p></div>
        <div className="macro-ledger">
          <MacroLine label="Protein" value={consumed.protein} target={TARGETS.protein} color="#b7d94c" note="build & recover" />
          <MacroLine label="Carbs" value={consumed.carbs} target={TARGETS.carbs} color="#7184df" note="train & refuel" />
          <MacroLine label="Fat" value={consumed.fat} target={TARGETS.fat} color="#ed9863" note="steady energy" />
          <MacroLine label="Fibre" value={consumed.fibre} target={TARGETS.fibre} color="#6f9782" note="30g minimum" />
        </div>
      </section>

      <section className="entry-card">
        <div className="entry-heading"><div><p className="eyebrow">Add food</p><h2>Say exactly what you ate.</h2><p className="entry-example">“192g cooked chicken, one Veetee rice pot and Nando&apos;s sauce.”</p></div><div className="meal-selector"><button type="button" className={mealName === "Lunch" ? "active" : ""} onClick={() => setMealName("Lunch")}>Lunch</button><button type="button" className={mealName === "Dinner" ? "active" : ""} onClick={() => setMealName("Dinner")}>Dinner</button><button type="button" className={mealName === "Snack" ? "active" : ""} onClick={() => setMealName("Snack")}>Snack</button></div></div>
        <form className="entry-row" onSubmit={previewEntry}>
          <input value={entry} onChange={(event) => setEntry(event.target.value)} aria-label="Describe your food" placeholder="e.g. 200g cooked mince, one rice pot and 100g peppers" />
          <button className={`mic-button ${listening ? "listening" : ""}`} type="button" onClick={toggleVoice} aria-label={listening ? "Stop listening" : "Start voice entry"}><span className="mic-icon">{listening ? "■" : "●"}</span><span>{listening ? "Listening…" : "Speak"}</span></button>
          <button className="check-button" type="submit">Check meal</button>
        </form>
        {parseError && <p className="parse-error" role="alert">{parseError}</p>}
        {previewItems.length > 0 && (
          <div className="preview-panel">
            <div className="preview-foods">{previewItems.map((item) => <span key={item.id}>{item.name}<strong>{item.display}</strong></span>)}</div>
            <div className="preview-totals"><span><strong>{round(previewMacros.calories)}</strong> kcal</span><span><strong>{round(previewMacros.protein, 1)}g</strong> protein</span><span><strong>{round(previewMacros.carbs, 1)}g</strong> carbs</span><span><strong>{round(previewMacros.fat, 1)}g</strong> fat</span><span><strong>{round(previewMacros.fibre, 1)}g</strong> fibre</span></div>
            <div className="preview-actions"><button type="button" className="ghost-button" onClick={() => setPreviewItems([])}>Change it</button><button type="button" className="log-button" onClick={logMeal}>Log this {mealName.toLowerCase()}</button></div>
          </div>
        )}
      </section>

      <section className="meals-section">
        <div className="section-heading"><div><p className="eyebrow">Today&apos;s diary</p><h2>{meals.length ? `${meals.length} meal${meals.length === 1 ? "" : "s"} logged` : "Nothing logged yet"}</h2></div></div>
        <div className="meal-list">
          {meals.map((meal) => (
            <article className="meal-card" key={meal.id}>
              <div className="meal-time">{meal.time}</div>
              <div className="meal-copy"><p>{meal.name}</p><h3>{meal.items.map((item) => item.name.replace("Cooked ", "")).join(" + ")}</h3><span>{meal.items.map((item) => `${item.display} ${item.name.toLowerCase()}`).join(" · ")}</span></div>
              <div className="meal-numbers"><span><strong>{round(meal.macros.calories)}</strong> kcal</span><span><strong>{round(meal.macros.protein, 1)}g</strong> protein</span></div>
              <button className="delete-button" type="button" onClick={() => removeMeal(meal.id)} aria-label={`Remove ${meal.name}`}>×</button>
            </article>
          ))}
        </div>
      </section>

      <footer><p>Nutrition estimates use the product values saved in this tracker. Check packaging when a recipe or product changes.</p><span>Targets: 1,800 kcal · 160P · 155C · 60F · 30 fibre</span></footer>
    </main>
  );
}
