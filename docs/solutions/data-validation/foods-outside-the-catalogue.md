---
title: Foods outside the catalogue
category: data-validation
date: 2026-08-17
symptom: "Told 'I only have 0% Greek yogurt and normal bagels', the chat replied that it had no entries for those and could not give real numbers."
status: fixed
---

## What happened

Joe asked what to finish the day on, was offered high-protein yoghurt and a Protein Boost
bagel, and said he only had 0% Greek yoghurt, plain bagels and peanut butter. The chat's answer
was, in effect, *I can't help with those*.

It was obeying its rules — never substitute a lookalike's numbers, never invent any — and the
rules were right. The gap was that they left it nowhere to go. `FOODS` is Joe's usual shop, and
the prompt treated it as the boundary of what he could eat rather than a starting point.

## Fix

Two routes out, in order:

1. **`search_food_database`** — Open Food Facts, which unlike Sainsbury's is a plain public API
   reachable from a serverless function with no bot protection. Results are filtered to entries
   that actually carry macros, UK products preferred, every one marked `provisional`.
2. **The label in his hand** — if the lookup finds nothing usable, ask for the per-100g panel.
   Four numbers, and it beats any database.

Both feed the same channel: `MealItem.per100g` (and `fitPortion`'s `variablePer100g`), which
supplies the macros the catalogue is missing. Everything else is unchanged — the scaling,
the day projection and the portion solver all still happen in TypeScript, so **the boundary
holds**: the model may now carry numbers *into* a tool, but it still never does arithmetic, and
those numbers must come from a tool result or from Joe, never from its own knowledge.

## Why this is not a hole in the "never invent" rule

There is a real difference between a model recalling that Greek yoghurt is "about 60 calories"
and a model passing through four figures Joe just read off the pot. The first is a guess wearing
the costume of a fact; the second is data entry. The schema says so explicitly, and looked-up
figures are flagged as provisional so they can be told apart from label-sourced ones on sight.

## The general shape

A refusal that is correct can still be a bad answer. "I won't guess" is only half a rule — it
needs "…and here is how I find out instead" attached, or it turns into a dead end the user has
to route around manually.
