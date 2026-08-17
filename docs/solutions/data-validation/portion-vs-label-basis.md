---
title: Scale portion macros from the label basis
category: data-validation
date: 2026-08-17
---

## Problem

The Veetee sticky-rice label displays nutrition per 100g, while one complete pot contains 130g. Treating the displayed values as a complete pot understated every macro by 30%.

## Fix

Each food records whether its nutrition is per 100g or per portion. The sticky-rice pot is stored as one 130g portion containing approximately 198 kcal, 3g protein, 41.2g carbohydrate and 2.3g fat.

## Guardrail

Rendered-output tests assert both the 130g portion weight and its scaled macro values.
