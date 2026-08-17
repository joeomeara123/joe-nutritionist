---
title: Convert raw weighings instead of failing the gram match
category: data-validation
date: 2026-08-17
---

## Problem

Meats are stored on a **cooked** basis (cooked chicken thighs: 168 kcal/100g), but Joe weighs
them raw, straight from the packet. The gram-matching regex accepted an optional `cooked`
before the food name but had no alternative for `raw`, so "428g raw chicken thighs" failed the
match entirely and fell through to the portion default — logging **one 64g thigh, 108 kcal**,
against an actual ~518 kcal. A 5x undercount, with no warning.

This is the same class of bug as the Veetee pot basis error: a stated basis that the code did
not honour.

## Fix

`Food` gained an optional `rawYield` (cooked-to-raw weight ratio; 0.72 for chicken thighs,
0.7 mince, 0.75 steak, 0.8 salmon). The regex now captures `cooked|raw` rather than tolerating
only `cooked`, and a raw weighing is multiplied by the yield before pricing. `ParsedFood`
records `fromRawGrams` so the original weighing survives into the diary and the chat.

## Guardrail

`tests/food-parser.test.ts` asserts 428g raw resolves to ~308g cooked and, separately, that the
result is greater than 200g — a direct regression test against the 64g fallback.
