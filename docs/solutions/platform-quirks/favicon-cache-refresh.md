---
title: Refresh a browser favicon with a new asset URL
category: platform-quirks
date: 2026-08-17
symptom: The live site tab continued to show a blank-looking generic icon.
root_cause: Browsers cache favicons aggressively, so replacing artwork at the existing URL may not refresh the tab.
---

# Favicon cache refresh

## Problem

The site already declared `/favicon.svg`, but the browser tab did not show a recognisable personal gym or food identity. Reusing that same URL risks retaining the cached appearance even after changing its contents.

## Fix

Publish the new artwork under a new descriptive URL and point both the standard icon and shortcut icon metadata to it. The new file uses a flexed-arm emoji on a high-contrast badge so it remains recognisable at small sizes.

## Verification

Build the production site, render the route, and confirm the generated icon links use the new URL. Render the SVG separately at a larger size to visually confirm the emoji, contrast, crop and coloured rim.
