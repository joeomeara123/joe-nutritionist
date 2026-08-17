---
title: Enforce daily fibre as a hard workbook-generation constraint
category: data-validation
date: 2026-08-15
symptom: One optimised day reached 29.3g fibre against a 30g minimum.
status: solved
---

# Daily fibre minimum in meal-plan optimisation

The portion optimiser originally treated a fibre shortfall as one weighted term among calories and macros. That allowed a small miss when the combined score was otherwise strong.

The fix makes fibre shortfall much more expensive, adds a small fixed Wednesday raspberry buffer, and adds a generation-time assertion for every day. Workbook generation now stops if any daily total is below 30g, so the exported shopping list cannot silently encode a failed minimum.

Verification: inspect the seven daily totals after formula calculation and require every fibre value to be at least 30g.
