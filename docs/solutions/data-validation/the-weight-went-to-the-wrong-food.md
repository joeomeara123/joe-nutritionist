---
title: A weight in front of a compound went to the wrong food
category: data-validation
date: 2026-08-19
symptom: "150g of uncooked pesto pasta" priced 150g of pesto and left the pasta on its 100g default — 468 kcal of sauce out of a sentence about pasta.
status: resolved
---

## What happened

Joe wrote *"3 chicken thighs and 150g of uncooked pesto pasta"* and got 955 kcal with 57.9g of
fat. Nearly half of that fat was pesto, because the parser read the sentence left to right and
each food grabbed whatever weight sat immediately in front of its own name. The pesto sat
between the number and the pasta, so the pesto took the 150g. The pasta fell back to its 100g
default, flagged `assumed` — and the "uncooked" was lost with it, so even the default was
priced as cooked.

Three separate facts Joe had stated were dropped by one sentence.

## The rule

"Pesto pasta" is one noun phrase, and English compounds are head-final: the pesto describes the
pasta, so the weight belongs to the pasta. Two changes make that work:

1. **Amounts are handed out after every food is located, not while scanning.** The parser now
   makes a pass to find which foods are named and where, then a second pass to assign
   quantities with the whole sentence in view.
2. **The second pass runs rightmost first**, so the head of a compound claims its weight before
   the word describing it gets a chance to. When a food finds no weight directly in front of
   it, it looks once more from the start of the food immediately preceding it — which is how
   the pasta reaches across "pesto" to "150g of uncooked".

A claimed amount is blanked out of a working copy of the sentence, so no two foods can be
priced from the same number.

## The limit, stated

Two food names with nothing between them read as one dish, so "200g chicken thighs broccoli"
puts the 200g on the broccoli. That is a malformed list rather than a phrase — a conjunction or
a comma separates them correctly — and whichever food loses out is flagged `assumed`, so it is
visible rather than silent. There is a test pinning this behaviour so it is a known trade-off
rather than a surprise.

## Three more stated facts that were going missing

Found while verifying the fix, all of the same kind — Joe said something and the app did not
hear it:

- **A curly apostrophe.** A phone keyboard types `’`, not `'`, and Joe logs from his phone, so
  "Nando's sauce" never matched. Swapped one-for-one at normalise time, which keeps every index
  aligned.
- **A missing alias.** The sauce answered to "nando sauce" and "nandos sauce" but not
  "nando's sauce" — the way it is actually written, including in the app's own example meal.
- **A basis word swallowed by an alias.** "192g cooked chicken" was logged as 138g: the word
  "cooked" is part of the alias `cooked chicken`, so the scan of the words in front found
  nothing and fell back to reading the weight as uncooked, converting away a quarter of the
  chicken Joe had just weighed. An alias that opens with a basis word is now stating one.

The dashboard's own example meal, `"192g cooked chicken, one Veetee sticky rice pot and Nando's
sauce"`, could not be parsed back into itself before these three. A test asserts that it can.
