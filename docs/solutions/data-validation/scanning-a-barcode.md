---
title: Scanning a barcode instead of searching by name
category: data-validation
date: 2026-08-18
symptom: Every product mix-up in this app traced back to searching for a food by name; the database returned a plausible wrong product and nothing marked it as wrong.
status: resolved
---

## What went wrong, repeatedly

Name search has been the single biggest source of bad numbers here. It gave a whipped feta
instead of feta, a flavoured rice instead of plain, and — checked while building this — returns
a Canadian sponge cake for "Sainsbury's peanut butter". Ranking by macro distance helped and
did not fix it: the search cannot tell a lightly smoked salmon fillet from a plain one, because
the numbers barely differ.

A barcode removes the guess entirely. One code, one product, nothing to rank.

## What the barcode does not fix

It gets the right product; it does not make that product's numbers true. Open Food Facts is
community-maintained, and three things had to be handled before any of it could be trusted:

- **Missing fibre is not zero.** Two entries for the same Sainsbury's Greek yogurt report 0.5g
  and 4.2g of fibre per 100g; the truth is about 0. Others omit the field entirely. Fibre is a
  hard 30g daily minimum here, so `ScannedMacros.fibre` is `number | null` and `null` renders
  as "not published", never as a measured zero.
- **A missing energy figure is not a zero-calorie food.** Without kcal, protein, carbs and fat
  the product is refused with `reason: "no-nutrition"`. Kilojoules are the one accepted
  substitute, converted at 4.184 and flagged.
- **A computed per-100g column is not a read one.** When a contributor entered a per-serving
  panel, the database divides by a serving size that may itself be wrong. Flagged rather than
  refused — usually fine, but it has to be visible.

## The rule this is really an instance of

An outage must not look like an absence. The name-search endpoint (`/cgi/search.pl`) started
returning 503 and `food-lookup.ts` mapped `!response.ok` to an empty array, so the chat told
Joe a food did not exist when the truth was that nobody had asked. Both modules now separate
"unreachable" from "not there", and the barcode route only treats a 404 as a genuine absence.

## Why a scan writes a permanent food

A scan that priced one meal would not be worth opening a camera for. Scanning writes a pantry
entry to `localStorage`, and the pantry is appended to `FOODS` wherever it is read — the
parser, `lookupFood`, and the chat's catalogue. Scan a jar once and "40g of it" works
everywhere from then on, including in a sentence mixing it with stocked foods.

`FOODS` itself is never mutated. Its order is load-bearing (cooking fats sit last so "oil"
cannot shadow "olive oil") and a test asserts every entry is sourced.

## Naming is the part that needed a guard

The parser matches aliases on whole words, so a new name can silently disable an old food or
be disabled by one. `aliasCollision` checks both directions: a new "oil" would be swallowed by
"olive oil", and a new "protein yogurt smoothie" would swallow "protein yogurt". This caught a
test I wrote myself — "english butter" is unusable as a name, because the stored "butter"
claims the word first.

## Scanning has to end in a logged meal

The first version stopped at a preview further down the page: a scan saved the food, filled the
add-food box and left the actual logging to a button Joe had to go and find. Scanning something
and saying "240g of that" is one intention, not two, so the scan sheet now shows what the
amount comes to and logs it — with the meal selector alongside, because the one on the page is
behind the overlay and a dinner scan was landing in lunch.

The running total goes through `parseFood` against the food about to be saved rather than
multiplying in the component. One code path means the figures in the sheet and the figures in
the diary cannot come apart.

## A scanned food outranks a stocked one

Refusing a clashing name was the wrong call, and the first real use showed it: Joe went to scan
salmon, and "salmon", "salmon fillet" and "sainsbury's salmon" were all rejected because the
app already had a generic `salmon` entry. There was no obvious way forward.

The pack in his hand is the more specific truth — a stored food is at best the same reading
taken earlier, from a product he may no longer buy. So a scan takes the name, the app says
plainly what it has taken over, and scanned foods sort ahead of `FOODS` in `parseFood` and
`lookupFood` so the precedence is real rather than advisory.

Clashing with **another scan** is still refused. There is no more-specific one of the two, and
rescanning a barcode replaces its entry anyway, so he never needs it.

## Verification

Both decoder paths were driven end to end against a real EAN-13 (5016805010255, the Veetee
sticky rice pot already cited in `FOODS`) rendered to a Y4M and fed to Chrome as a fake camera:
the native `BarcodeDetector`, and — with `window.BarcodeDetector` deleted — the WebAssembly
ponyfill that iOS Safari has to use. Both resolved to the right product, and the `.wasm` was
served from this app rather than a CDN.
