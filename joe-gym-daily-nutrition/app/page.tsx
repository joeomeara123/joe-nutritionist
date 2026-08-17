"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FOODS, parseFood, scaled, type Macros, type ParsedFood } from "@/lib/food-parser";
import { recommendDay, type Suggestion } from "@/lib/recommendations";
import Chat from "./chat";

type Meal = { id: string; name: string; text: string; time: string; items: ParsedFood[]; macros: Macros };
type Diary = Record<string, Meal[]>;

const TARGETS: Macros = { calories: 1800, protein: 160, carbs: 155, fat: 60, fibre: 30 };
const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };
const CALORIE_SPLIT = [
  { label: "Protein", grams: 160, calories: 640, percent: 35.6, color: "#ff3b30" },
  { label: "Carbs", grams: 155, calories: 620, percent: 34.4, color: "#1769ff" },
  { label: "Fat", grams: 60, calories: 540, percent: 30, color: "#ffc400" },
];

const addMacros = (a: Macros, b: Macros): Macros => ({ calories: a.calories + b.calories, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat, fibre: a.fibre + b.fibre });
const round = (value: number, places = 0) => Number(value.toFixed(places));
const dateKey = (date = new Date()) => date.toLocaleDateString("en-CA");
const longDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00`));

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
  const [recommendationSelection, setRecommendationSelection] = useState({ key: "", index: 0 });
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
  const properMealCount = meals.filter((meal) => meal.name !== "Snack").length;
  const consumed = total(meals);
  const previewMacros = total(previewItems);
  const coach = coachMessage(consumed, previewItems.length ? previewMacros : undefined);
  const recommendation = recommendDay(consumed, properMealCount, new Date().getHours());
  const recommendationKey = `${selectedDate}:${meals.length}:${consumed.calories}:${consumed.protein}:${consumed.carbs}:${consumed.fat}:${consumed.fibre}`;
  const activeChoiceIndex = recommendationSelection.key === recommendationKey ? recommendationSelection.index % recommendation.choices.length : 0;
  const activeRecommendation = recommendation.choices[activeChoiceIndex] || recommendation;
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

  /** One-time migration path off the old Codex deployment. The diary only ever lived in
   *  localStorage, so moving origin loses it unless Joe carries the JSON across. Existing days
   *  win over imported ones, so re-importing can never clobber something logged here. */
  async function importDiary(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Diary;
      const days = Object.keys(parsed);
      if (!days.length || !Array.isArray(parsed[days[0]])) throw new Error("shape");
      setDiary((current) => ({ ...parsed, ...current }));
      setParseError(`Imported ${days.length} day${days.length === 1 ? "" : "s"} of history.`);
    } catch {
      setParseError("That file isn’t a diary export. Run copy(localStorage.getItem('joe-gym-diary-v1')) on the old site and save the result as .json.");
    }
  }

  /** The chat solves the portion; the diary still parses and prices it, so a logged meal is
   *  identical whether it came from the form or the conversation. */
  function logMealFromChat(name: string, text: string) {
    const parsed = parseFood(text);
    if (!parsed.items.length) { setParseError(`I couldn’t log “${text}” — none of those foods are stored yet.`); return; }
    const now = new Date();
    const meal: Meal = {
      id: `${Date.now()}`,
      name,
      text,
      time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      items: parsed.items,
      macros: total(parsed.items),
    };
    setDiary((current) => ({ ...current, [selectedDate]: [...(current[selectedDate] || []), meal] }));
  }

  function removeMeal(id: string) {
    setDiary((current) => ({ ...current, [selectedDate]: (current[selectedDate] || []).filter((meal) => meal.id !== id) }));
  }

  function loadRecommendation(suggestion: Suggestion) {
    const parsed = parseFood(suggestion.logText);
    setEntry(suggestion.logText);
    setPreviewItems(parsed.items);
    setParseError("");
    setMealName(suggestion.kind === "snack" ? "Snack" : properMealCount ? "Dinner" : "Lunch");
    requestAnimationFrame(() => document.getElementById("meal-entry")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  function suggestSomethingElse() {
    setRecommendationSelection({ key: recommendationKey, index: (activeChoiceIndex + 1) % recommendation.choices.length });
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
        <label className="date-button import-button" title="Import a diary exported from the old Codex-hosted site">Import
          <input type="file" accept="application/json,.json" onChange={importDiary} />
        </label>
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
            <div className="wheel-centre"><strong>{caloriePct}%</strong><span>eaten</span><small>{round(consumed.calories)} / 1,800 kcal</small></div>
          </div>
          <div className="remaining-kcal"><strong>{Math.abs(round(TARGETS.calories - consumed.calories))}</strong><span>kcal {consumed.calories <= TARGETS.calories ? "left" : "over"}</span></div>
        </div>
      </section>

      <article className={`coach-strip ${coach.tone}`}><span className="coach-dot">●</span><div><strong>{coach.title}</strong><p>{coach.body}</p></div></article>

      {selectedDate === today && (
        <section className="recommendation-card">
          <div className="recommendation-spectrum" aria-hidden="true" />
          <div className="recommendation-heading">
            <div><p className="eyebrow">Eat next</p><h2>{activeRecommendation.next.title}</h2><p>{recommendation.intro}</p></div>
            <div className="recommendation-meta"><span className="recommendation-context">{recommendation.context}</span><span className="recommendation-choice">Option {activeChoiceIndex + 1} of {recommendation.choices.length}</span></div>
          </div>
          <div className="recommendation-main" key={activeRecommendation.next.id}>
            <div className="recommendation-foods">
              {activeRecommendation.next.items.map((item) => <span key={item}>{item}</span>)}
            </div>
            <div className="recommendation-macros" aria-label="Recommended meal nutrition">
              <span><strong>{round(activeRecommendation.next.macros.calories)}</strong> kcal</span>
              <span><strong>{round(activeRecommendation.next.macros.protein, 1)}g</strong> protein</span>
              <span><strong>{round(activeRecommendation.next.macros.carbs, 1)}g</strong> carbs</span>
              <span><strong>{round(activeRecommendation.next.macros.fat, 1)}g</strong> fat</span>
              <span><strong>{round(activeRecommendation.next.macros.fibre, 1)}g</strong> fibre</span>
            </div>
            <div className="recommendation-actions">
              <button type="button" className="recommendation-button" onClick={() => loadRecommendation(activeRecommendation.next)}>Yeah, that looks good</button>
              <button type="button" className="recommendation-skip-button" onClick={suggestSomethingElse}>Suggest something else <span aria-hidden="true">→</span></button>
            </div>
          </div>
          {activeRecommendation.later.length > 0 && (
            <div className="later-plan">
              <div><p className="eyebrow">Later today</p><strong>Use these only after the next meal</strong></div>
              <div className="later-list">
                {activeRecommendation.later.map((item, index) => (
                  <button type="button" key={`${item.id}-${index}`} onClick={() => loadRecommendation(item)}>
                    <span>{index + 1}</span><strong>{item.title}</strong><small>{round(item.macros.calories)} kcal · {round(item.macros.protein, 1)}g protein</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="recommendation-note">{activeRecommendation.note}</p>
        </section>
      )}

      <Chat day={{ consumed, mealCount: properMealCount, hour: new Date().getHours() }} onLogMeal={logMealFromChat} />

      <section className="macro-section">
        <div className="section-heading"><div><p className="eyebrow">What remains</p><h2>Today&apos;s targets</h2></div><p className="muted">Live after every meal</p></div>
        <div className="macro-ledger">
          <MacroLine label="Protein" value={consumed.protein} target={TARGETS.protein} color="#ff3b30" note="build & recover" />
          <MacroLine label="Carbs" value={consumed.carbs} target={TARGETS.carbs} color="#1769ff" note="train & refuel" />
          <MacroLine label="Fat" value={consumed.fat} target={TARGETS.fat} color="#ffc400" note="steady energy" />
          <MacroLine label="Fibre" value={consumed.fibre} target={TARGETS.fibre} color="#6f9782" note="30g minimum" />
        </div>
      </section>

      <section className="entry-card" id="meal-entry">
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
