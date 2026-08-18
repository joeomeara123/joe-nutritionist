"use client";

import { MACRO_FIELDS, estimateCalories, type MacroDraft } from "@/lib/macros";

/**
 * The five macro boxes, wherever they are needed: the barcode confirm panel, a hand-entered
 * meal, and correcting one already in the diary. One component so the three cannot drift —
 * they are the same five figures under the same rules about what a blank box means.
 */
export default function MacroFields({
  draft,
  onChange,
  legend,
  context,
  fibrePlaceholder,
}: {
  draft: MacroDraft;
  onChange: (draft: MacroDraft) => void;
  legend: string;
  /** Appended to each box's accessible name, e.g. "per 100g". */
  context: string;
  fibrePlaceholder?: string;
}) {
  // Offered, never applied on its own: it estimates what a label would say rather than
  // reproducing one, and a figure the app quietly filled in is the thing this app exists to stop.
  const estimate = draft.calories.trim() === "" ? estimateCalories(draft) : null;

  return (
    <>
      <fieldset className="macro-fields">
        <legend>{legend}</legend>
        {MACRO_FIELDS.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            <input
              value={draft[field.key]}
              onChange={(event) => onChange({ ...draft, [field.key]: event.target.value })}
              inputMode="decimal"
              placeholder={field.key === "fibre" ? fibrePlaceholder : ""}
              aria-label={`${field.label} ${context}`}
            />
          </label>
        ))}
      </fieldset>
      {estimate !== null && (
        <button type="button" className="macro-estimate" onClick={() => onChange({ ...draft, calories: String(estimate) })}>
          ≈ {estimate} kcal from the other figures — tap to use
        </button>
      )}
    </>
  );
}
