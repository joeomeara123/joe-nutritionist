---
title: Verify spreadsheet row targets by semantic keys
category: data-validation
date: 2026-08-15
symptom: Hand-counted row numbers changed adjacent ingredient amounts and temporarily corrupted four daily macro totals.
status: solved
---

# Spreadsheet row-target verification

An imported meal-plan workbook was adjusted by writing new amounts to absolute `E`-column cells. The target row numbers had been counted from a printed table, but some days contained a different number of ingredient rows. That shifted later edits onto spring onions or the next protein row.

The immediate fix restored the affected ingredient amounts, applied the intended protein and rice edits to the correct rows, and recalculated the workbook. The durable rule is to resolve an editable row from its semantic key—`Day + Meal + Food`—instead of hand-counting absolute row numbers.

Verification must inspect the food label and new amount together for every changed row, then recalculate and assert all seven daily calories, protein and fibre totals. A formula-error scan alone is insufficient because valid formulas can still calculate from a valid but unintended input cell.
