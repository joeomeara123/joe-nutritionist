---
title: Letting Joe type the macros himself
category: data-validation
date: 2026-08-18
symptom: Every number in the app was derived from a food, so a meal the parser could not read had no way in and a meal it read wrong had no way out.
status: resolved
---

## The gap

Macros were only ever derived: parsed from a sentence, scaled from a label, solved by a tool.
That is the right default and it is also a closed world. A restaurant meal has no barcode and
no label. A mis-parsed meal sat in the diary being wrong with no way to say "the number is
62g, just take it".

## His numbers are not a lesser source

The instinct is to treat a hand-typed figure as an estimate — the fallback when the good paths
fail. That is backwards. A number Joe read off a menu or a packet beats anything this app can
derive from a stored food, because the stored food is at best the same reading taken earlier.

So a hand-entered meal is recorded as the most authoritative kind of entry there is. The only
thing that has to stay visible is *that it came from him*, so a later reader can tell a typed
total from a derived one.

## One authority, and a labelled divergence

`Meal.macros` is the only figure the day totals read, so it stays the single authority and
`items` are what produced it — not a second source of truth. Correcting a meal deliberately
makes them disagree, and the disagreement is the point:

- `entered: "hand"` — the total came from Joe.
- `parsed` — what the items came to before he corrected them, so the change is inspectable
  and revertible.
- `fibreUnknown` — he gave no fibre figure, so the 0 is a placeholder.

This is only safe *because* it is labelled. The failure it must not repeat is
`recommendations.ts`, where a hardcoded total and a `logText` disagreed with nothing marking
which was true. A card whose numbers no longer match the foods listed on it says so, and says
what they were.

## What a blank box means

A blank required box fails the whole entry rather than defaulting to zero — a plate of food is
not 0g of protein, and an entry that silently reads as one is worse than no entry at all.
Fibre is the exception, because it has to count as *something*: it counts as zero and the meal
is marked, the same treatment scanned foods get.

## Calories offered, never applied

With protein, carbs and fat filled, the form offers `4P + 4C + 9F + 2 fibre` as something to
tap. UK labels exclude fibre from carbohydrate and count it at about 2 kcal/g, hence the extra
term. It stays a tap because Atwater factors approximate what a label says rather than
reproducing it — and a figure the app quietly filled in is the exact failure this app exists
to stop.

## Found while verifying: a positional index into FOODS

The example meal read `FOODS[13]`, which was Nando's sauce until spring onions were inserted
above it. After that the card said "Nando's sauce" and logged 20g of oven chips — the same
two-sources-of-truth shape, and invisible because both halves looked reasonable. Foods are
resolved by id now. **Never index `FOODS` positionally.**
