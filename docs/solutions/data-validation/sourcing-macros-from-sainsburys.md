---
title: Sourcing macros from Sainsbury's product pages
category: data-validation
date: 2026-08-17
symptom: "Food macros were hand-entered with no recorded provenance, so nothing could be checked and nothing said which numbers were guesses."
status: fixed
---

## Why

Joe asked for the food table to come from Sainsbury's, since that is where the food comes from.
The stronger reason is that the old table had no provenance at all: chicken and butter turned
out to match Sainsbury's exactly, avocado turned out to be an American figure, and nothing on
screen distinguished the two.

## Getting the data

`curl` gets a 403 from Akamai. A real Chrome via `playwright-core` loads the site fine, and
from inside a loaded page `fetch()` reaches their JSON API with the session's own cookies:

- search — `/groceries-api/gol-services/product/v1/product?filter[keyword]=…&page_size=10`
- detail — `/groceries-api/gol-services/product/v1/product/{product_uid}`

The nutrition table lives in `details_html`, **base64-encoded**, and only on the detail
response. Three traps, each of which silently produced an empty result rather than an error:

1. **Search wraps the product in `products[]`; detail returns it bare.** `parsed.products[0]`
   on a detail response is `undefined`, so every product looked like it had no nutrition.
2. **The energy row omits its label cell** (the kJ/kcal rowspan), so that row is one cell
   short and every column shifts left by one. Reading by fixed index gets the wrong number.
3. **A product can publish several "per 100g" columns** — dry and cooked, or as-sold and
   prepared. Sainsbury's own fusilli publishes only a *cooked* table, which is why it reads
   164 kcal against De Cecco's 351 for the same food.

## Picking the right product

A keyword search returns dozens of products and the top hit is usually wrong — "sticky rice"
finds Tilda Soy & Ginger, "feta" finds halloumi. Matching by name alone put whipped feta and
flavoured rice into the table.

What worked: **score every candidate by distance from the macros already stored**, because
those came from Joe's real products and therefore identify them. That found
`Kallo Beetroot Veggie Cake` at a distance of 0.014 from an entry labelled only "Beetroot
veggie cakes", and confirmed the chicken, steak and butter rows were already exact.

The comparison only works per 100g. Portion-basis foods store macros *per portion*, so they
must be scaled first — six foods looked like mismatches purely because a 20g serving was being
compared against a 100g label.

## What is deliberately not sourced

Six foods have no `source`: Sainsbury's stocks them but publishes no nutrition table, and the
Veetee rice pots in particular are load-bearing for Joe's meals. Their macros are the original
estimates. `tests/food-data.test.ts` asserts that list **exactly**, so a new unsourced food
fails the suite rather than blending in. The chat's food catalogue marks them `[ESTIMATE]` and
the prompt asks it to say so when one drives the answer.

Olive oil is a subtler case: the label is per 100 **ml** and Joe weighs in grams, so the figure
cannot be used without an oil-density conversion. Left as the standard per-100g value.

## The knock-on find

`lib/recommendations.ts` hardcoded each suggestion's macros *and* a `logText` that the parser
would read differently — two sources of truth that agreed only by luck. Changing the food data
would have made the card say one thing and the logged meal another.

Suggestions now derive their macros from their own `logText`. That change immediately failed
on `"one Veetee sticky rice pot"`, where the parser matched the alias `veetee sticky rice` and
reported the trailing `pot` as an unrecognised food — a bug that had been reachable from the
Add Food box all along, and that no hardcoded table would ever have surfaced.
