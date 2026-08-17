---
title: Align conic-gradient sectors with radial dividers
category: css-visualization
date: 2026-08-17
---

## Symptom

Each macro progress bar filled inside the correct-sized sector but began 90 degrees away from its matching radial divider.

## Root cause

CSS conic gradients use 12 o'clock as their default zero-angle origin. The progress gradient added `from -90deg`, shifting every coloured sector anticlockwise. The divider elements use ordinary CSS transforms, whose zero-angle direction points right, so their converted angles were already correct.

## Fix

Keep the conic gradient at its default 12 o'clock origin. Continue converting each top-origin sector boundary to a transform angle by subtracting 90 degrees for the radial divider.

## Guardrail

The wheel regression test rejects a `from -90deg` offset on the progress gradient and asserts that the protein fill starts at zero, directly beside the 12 o'clock divider.
