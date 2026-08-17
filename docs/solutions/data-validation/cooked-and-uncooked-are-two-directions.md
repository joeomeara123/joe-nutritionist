---
title: Cooked and uncooked are two directions, not one
category: data-validation
date: 2026-08-17
symptom: "225g of cooked pasta was priced as 225g of dry pasta — 790 kcal instead of 351 — and a weight after a comma was credited to the previous food."
status: fixed
---

## Two bugs in one line

`3 chicken thighs, 225g of cooked pasta, and pesto` produced **225g of chicken** and **225g of
dry pasta**.

### The weight jumped the comma

Bracket support was added by letting the forward scan skip `[\s,(]*` before the number. That
class contains a comma, so the chicken's forward scan ran past the comma and took the pasta's
`225g`. Both foods then claimed the same number, and the chicken's count of three was ignored.

Every figure on screen was real and traceable. The meal was still wrong. The forward scan now
skips whitespace only, and brackets are handled a different way (below).

### "Cooked" was treated as a synonym for "no change"

The original model was `rawYield`: a single ratio for foods stored on a *cooked* basis, used to
convert a raw weighing down. That quietly assumed every food is stored cooked.

Pasta is stored **dry**. `225g of cooked pasta` is about 100g dry, so reading it as 225g of the
stored basis more than doubled it. The conversion has to run in both directions, and they are
not symmetric:

| Joe says | Stored as | Correction |
|---|---|---|
| 392g uncooked chicken | cooked | × 0.72 → 282g |
| 200g cooked chicken | cooked | none |
| 225g cooked pasta | dry | ÷ 2.25 → 100g |
| 100g dry pasta | dry | none |

So `rawYield` became `weighedAs` (which state the stored macros describe) plus `cookedRatio`
(always cooked mass ÷ uncooked mass — chicken 0.72, pasta 2.25). One helper, `toStoredGrams`,
now owns the conversion for both the typed form and the chat's tools, so they cannot disagree.

The pasta ratio comes from Joe himself: he wrote "100g of uncooked pasta (225 cooked)".

## Brackets

Joe writes the real weight in brackets on either side of the food — `3 uncooked (392g) chicken
thighs`, `some pesto (2 teaspoons)`. Rather than teaching every pattern about brackets, the
normaliser replaces `()[]` with **spaces**, which keeps every string index aligned with the
original text. Once brackets are spaces, `uncooked  392g  chicken thighs` matches the same rule
as the unbracketed form. Spoon measures also had to be read *after* the food, not only before.

## The general shape

Three rounds of this bug have all been the same thing: **the parser could not find something,
substituted a default, and rendered the default identically to a real reading.** A quantity it
invented (100g of pesto), a basis it ignored (cooked pasta), a number it borrowed from the next
clause.

The fix each time is the same discipline — read what was actually written, and where the parser
supplies something itself, show that on the chip. Converted weights now render "from 225g
cooked" underneath the figure, because the number shown is deliberately *not* the number Joe
typed, and that must not look like a mistake.

## Still open

An **unqualified** weight ("392g chicken thighs") is taken at the stored basis by the form but
as uncooked by the chat. Deliberately not resolved here: which is right depends on how Joe
actually weighs, and the two-line change should follow his answer rather than a guess.
