---
title: Give the model a portion count, never let it compute grams
category: data-validation
date: 2026-08-17
---

## Problem

The chat's tools took only `grams`. Asked "how much rice for 3 chicken thighs", Claude looked
up the 64g thigh portion and passed `grams: 64` — one thigh, not three — while its prose
correctly said "~64g cooked each". The meal came back 648 kcal / 24.1g protein instead of
863 / 55.8. Every number was genuinely tool-derived, so no fabrication check caught it; the
error was in the tool *input*.

The root cause is a design slip. The whole point of `lib/nutrition-tools.ts` is that the model
never does arithmetic — and `3 x 64` is arithmetic. Leaving that multiplication on the model's
side of the boundary guaranteed it would eventually get it wrong, and non-deterministically:
some runs sent 192, some sent 64.

## Fix

`MealItem` gained `portions`. "Three chicken thighs" is `portions: 3`; the tool multiplies by
the stored `portionGrams`. The tool description says explicitly not to compute grams from a
count. A `raw` flag alongside `portions` is now ignored, because a counted portion is already
on the food's own basis and converting it would discount the weight twice.

## Guardrail

`tests/nutrition-tools.test.ts` asserts `portions: 3` equals `grams: 192`, and that a stray
`raw: true` on a counted portion changes nothing.

The general rule: if a tool boundary leaves any calculation on the model's side, move the
boundary. Verifying that quoted numbers came from tool results is not enough — the inputs need
checking too.
