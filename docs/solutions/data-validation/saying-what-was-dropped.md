---
title: Saying what the parser could not place
category: data-validation
date: 2026-08-19
symptom: "250g of mince, a veetee pot, mixed veg" priced the mince and silently binned the other two; "egg" dead-ended on an example sentence.
status: resolved
---

## Silence about what was dropped

`parseFood` had returned an `unknown` list since the first build, and nothing rendered it. So a
line naming three foods produced a 294 kcal preview for one of them, and the missing rice pot
and plate of veg left no trace. Everything the parser understood was on screen; everything it
did not was gone.

The preview now names what it could not place, in the words Joe wrote — "a veetee pot", not the
filler-stripped "veetee", which is a riddle rather than something to act on. It reads out of
the residue rather than the original, so "a chicken katsu curry" reports "katsu curry": the
chicken in it *was* counted, and saying otherwise would be its own small lie.

## Suggestions, not resolutions

An unrecognised phrase is offered the stocked foods it shares a whole word with. "a veetee pot"
matches both Veetee pots and does not say which — they are 4 kcal apart, which is exactly the
gap that makes picking one feel harmless and makes it a guess anyway. So it asks.

## A refusal needs a way out

"egg" produced *"I couldn't recognise that yet. Try: 200g cooked chicken…"* — an example
sentence that does not mention the food Joe typed. Same half-a-rule as the chat before it:
"I don't know that" needs "and here is how to tell me" attached. The panel now carries **Scan
its barcode** and **Type its macros**, which are the two routes the app already has.

Eggs were also simply missing, so they are now stocked — Sainsbury's medium and large packs
publish identical figures, which is the corroboration that makes it usable. Their fibre column
reads 0.5g on both; an egg contains no plant material, so that is recorded as 0 and the reason
is written into the source.

## Filler is not the same as grammar

The first attempt added "grilled", "scrambled" and friends to the filler list. That stopped
them being reported as unknown foods and did nothing about the real damage: **"200g grilled
chicken" logged one 64g thigh**, because the weight scan could not cross the adjective either.
A stated weight was being lost to a word the app had decided to ignore — worse than before,
because ignoring it also removed the only hint that something was wrong.

Preparation words belong with `cooked`, `raw` and `dry` instead. Named there, the number reaches
the food *and* "grilled" is read for what it says: that the chicken was cooked, so 200g stays
200g rather than being converted down as if it had been weighed raw.

**Ignoring a word is not the same as understanding it.** If a word has to be stepped over, ask
what it means first.
