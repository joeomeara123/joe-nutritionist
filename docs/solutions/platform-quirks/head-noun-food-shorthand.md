---
title: Resolve food shorthand by head noun, not alias length
category: platform-quirks
date: 2026-08-17
---

## Problem

The chat needs "rice" to resolve to the Veetee sticky-rice pot, but no stored alias is bare
`rice` — they are all `sticky rice`, `jasmine rice`, `rice cakes`. A partial match ranked by
alias length picked **`rice cakes` (10 chars)** over **`sticky rice` (11 chars)**, so asking
"how much rice do I need" sized beetroot veggie cakes instead.

## Fix

`lookupFood` prefers an alias whose **last** word is the query. In an English compound the head
noun is final: "sticky rice" is a kind of rice, "rice cakes" is a kind of cake. Alias length is
only the tie-breaker.

## Guardrail

`tests/nutrition-tools.test.ts` asserts `lookupFood("rice")` resolves to `sticky-rice`.
