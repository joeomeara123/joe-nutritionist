import { describe, expect, test } from "bun:test";

const recommendationModule = await import("../lib/recommendations").catch(() => ({}));
const recommendDay = "recommendDay" in recommendationModule
  ? recommendationModule.recommendDay as (consumed: MacroTotals, mealCount: number, hour: number) => DayPlan
  : undefined;

type MacroTotals = { calories: number; protein: number; carbs: number; fat: number; fibre: number };
type Suggestion = { kind: "meal" | "snack"; title: string; macros: MacroTotals };
type PlanChoice = { next: Suggestion; later: Suggestion[]; projected: MacroTotals; gaps: MacroTotals; note: string };
type DayPlan = {
  context: string;
  next: Suggestion;
  later: Suggestion[];
  projected: MacroTotals;
  gaps: MacroTotals;
  note: string;
  choices: PlanChoice[];
};

describe("daily food recommendations", () => {
  test("plans two sensible meals when nothing has been logged", () => {
    expect(typeof recommendDay).toBe("function");
    if (!recommendDay) return;

    const plan = recommendDay({ calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }, 0, 9);

    expect(plan.context).toContain("Morning");
    expect(plan.next.kind).toBe("meal");
    expect(plan.later.some((item) => item.kind === "meal")).toBe(true);
    expect([plan.next, ...plan.later].every((item) => item.macros.calories <= 800)).toBe(true);
  });

  test("suggests the second meal followed only by top-ups after one meal", () => {
    expect(typeof recommendDay).toBe("function");
    if (!recommendDay) return;

    const plan = recommendDay({ calories: 530, protein: 50.8, carbs: 41.7, fat: 17.4, fibre: 0.3 }, 1, 18);

    expect(plan.context).toContain("Evening");
    expect(plan.next.kind).toBe("meal");
    expect(plan.later.length).toBeGreaterThan(0);
    expect(plan.later.every((item) => item.kind === "snack")).toBe(true);
    expect(plan.projected.protein).toBeGreaterThanOrEqual(160);
    expect(plan.projected.calories).toBeLessThanOrEqual(1900);
    expect(plan.note.length).toBeGreaterThan(0);
  });

  test("offers many distinct fully planned alternatives after one meal", () => {
    expect(typeof recommendDay).toBe("function");
    if (!recommendDay) return;

    const plan = recommendDay({ calories: 530, protein: 50.8, carbs: 41.7, fat: 17.4, fibre: 0.3 }, 1, 18);
    expect(Array.isArray(plan.choices)).toBe(true);
    if (!plan.choices) return;
    const nextTitles = plan.choices.map((choice) => choice.next.title);

    expect(plan.choices.length).toBeGreaterThanOrEqual(8);
    expect(new Set(nextTitles).size).toBe(plan.choices.length);
    expect(plan.choices.every((choice) => choice.next.kind === "meal")).toBe(true);
    expect(plan.choices.every((choice) => choice.later.every((item) => item.kind === "snack"))).toBe(true);
  });

  test("uses snacks to close a small protein gap after two meals", () => {
    expect(typeof recommendDay).toBe("function");
    if (!recommendDay) return;

    const plan = recommendDay({ calories: 1650, protein: 140, carbs: 148, fat: 55, fibre: 28 }, 2, 20);

    expect(plan.next.kind).toBe("snack");
    expect(plan.projected.protein).toBeGreaterThanOrEqual(160);
    expect(plan.next.macros.calories).toBeLessThanOrEqual(350);
  });

  test("recommends another proper meal after two small meals leave a large gap", () => {
    expect(typeof recommendDay).toBe("function");
    if (!recommendDay) return;

    const plan = recommendDay({ calories: 800, protein: 65, carbs: 60, fat: 25, fibre: 8 }, 2, 19);

    expect(plan.next.kind).toBe("meal");
    expect(plan.next.macros.calories).toBeLessThanOrEqual(800);
  });
});
