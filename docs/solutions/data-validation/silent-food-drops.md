---
title: Report unrecognised foods instead of dropping them
category: data-validation
date: 2026-08-17
---

## Problem

`parseFood` returned `unknown: found.length ? [] : [text]`, so the unrecognised part of a line
was reported **only when nothing at all matched**. In any mixed line the unmatched food was
discarded in silence: logging "308g cooked chicken thighs and 4g olive oil" recorded the
chicken, dropped the oil, and reported success. The day then ran a hidden deficit that grew
every time the same meal was logged.

Two things made it invisible. There was no oil in `FOODS` to match in the first place, and the
UI had nothing to display because the parser never said anything was missing.

## Fix

The parser now blanks out every span it accounts for — the alias, its gram prefix or suffix,
and any counting word — and treats whatever survives as unrecognised, after stripping filler
words and numbers. Olive oil and butter were added to `FOODS`.

Alias matching also moved from `String.includes` to a word-boundary regex. Substring matching
would have made the new short aliases dangerous: `oil` matches inside `boiled`, and `butter`
matches inside `peanut butter`. The cooking fats are additionally ordered last in `FOODS` so a
longer name containing them is always claimed first.

## Guardrail

`tests/food-parser.test.ts` asserts that a line mixing a stocked and an unstocked food reports
the unstocked one, and that oil is priced rather than ignored.
