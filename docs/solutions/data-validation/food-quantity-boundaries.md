---
title: Keep spoken food quantities attached to the correct food
category: data-validation
date: 2026-08-17
symptom: A quantity after "and" was incorrectly applied to the preceding food.
root_cause: The post-alias grams pattern allowed arbitrary non-numeric words before the number.
---

# Food quantity boundaries

## Problem

The phrase `one protein bagel and 15g peanut butter` was parsed as a 15g bagel. The parser searched for a gram value after the bagel alias without requiring that value to be adjacent, so it crossed the `and` boundary and captured the peanut butter quantity.

## Fix

Only interpret a post-food quantity when the numeric value immediately follows the matched alias, allowing whitespace but not intervening words. Quantities written before a food remain valid.

## Verification

Keep a regression test containing two foods with the second food's weight after `and`. Confirm the first food retains its default portion while the second receives the explicit weight, then run the full parser tests and production build.
