---
title: Quantities the parser invented
category: data-validation
date: 2026-08-17
symptom: "A meal with three stated quantities logged 922 kcal instead of 879, and 32.6g protein instead of 82.5g — every figure looked plausible."
status: fixed
---

## What happened

Joe typed one sentence into the Add Food box:

> I just had 3 chicken thighs (392g uncooked) and 100g of uncooked pasta (225 cooked)
> and 2 teaspoons of pesto

He was shown **64g of chicken, 100g of pasta and 100g of pesto** — 922 kcal, 32.6g protein,
52.5g fat. The true meal is **282g / 100g / 10g** — 879 kcal, 82.5g protein, 27.6g fat.

He had stated a quantity for all three foods. The parser read none of them.

## Four independent failures, all silent

1. **Numerals were not counts.** `wordBefore` matched `a|an|one|two|three|four` only, so
   "3 chicken thighs" scored a count of 1 while "three chicken thighs" scored 3.
2. **A weight in brackets was invisible.** `gramsAfter` was anchored `^\s*(\d+)`, and
   "(392g uncooked)" starts with a bracket, so the weight never matched.
3. **"uncooked" broke the weight match entirely.** The basis group was `(cooked|raw)`.
   Against "100g of uncooked pasta" the group cannot consume "un", the `$` anchor then fails,
   and the *whole* gram match fails — the stated weight is discarded, not just its basis.
   `cooked` being a strict prefix of `uncooked` is the trap; the longer word must come first
   in the alternation.
4. **Spoons were not a measurement.** "2 teaspoons of pesto" matched no quantity rule.

## The failure that mattered most

Each miss fell through to the same default: `food.portionGrams || 100`. Pesto had no
`portionGrams`, so two teaspoons became **100g of pesto — 455 kcal and 46.1g of fat**, over
half the meal's calories, invented outright.

A parser that cannot find a quantity was assuming a large one and saying nothing. That is the
same class of bug as [raw-versus-cooked-weight](raw-versus-cooked-weight.md) and
[silent-food-drops](silent-food-drops.md): the output is confident, well-formed, and wrong,
so nothing about the screen invites a second look.

## Fix

- Numerals accepted wherever number words were (`COUNT`).
- `gramsAfter` skips leading brackets and commas and captures a trailing basis word.
- `BASIS` is `uncooked|cooked|raw` — longest first — and `isRaw()` treats "uncooked" as raw.
- Teaspoons and tablespoons are a quantity. A food's own tablespoon wins over the generic 15g
  (olive oil is 13.5g), and a teaspoon is a third of a tablespoon.
- Calorie-dense condiments carry a `portionGrams` serving, so an unquantified mention costs a
  spoonful rather than 100g.
- **`ParsedFood.assumed` marks any quantity the parser supplied rather than read**, and the
  preview chip renders it in amber with "assumed — say the amount".

That last one is the general lesson. Where a parser must guess, the guess has to be visible in
the UI; a defaulted number that renders identically to a measured one is indistinguishable
from a correct answer at exactly the moment it is wrong.

## Guarding it

`tests/food-parser.test.ts` covers each failure separately plus Joe's full sentence, asserting
both the per-item grams and the meal totals. The old behaviour reproduced all five of the
numbers on his screenshot exactly, which is how the diagnosis was confirmed before any edit.
