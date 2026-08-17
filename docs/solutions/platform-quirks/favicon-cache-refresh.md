---
title: Keep a browser favicon link inside the document head
category: platform-quirks
date: 2026-08-17
symptom: The live site tab continued to show a blank-looking generic icon.
root_cause: Dynamic metadata streamed the favicon link into the document body, where the browser did not reliably recognise it.
---

# Favicon cache refresh

## Problem

The site declared a valid, reachable favicon, but the browser tab still showed no icon. The production HTML revealed that asynchronous metadata placed the icon link in a hidden block after the document head. The asset itself returned successfully, so the fault was link placement rather than packaging.

## Fix

Render the standard and shortcut icon links directly inside the root layout's `<head>`. Use a versioned query string so browsers do not reuse an older favicon cache entry. Keep the flexed-arm artwork on a high-contrast badge so it remains recognisable at small sizes.

## Verification

Build the production site and inspect only the content between `<head>` and `</head>`, confirming that it contains the versioned icon link. Check that the published icon asset returns successfully, then refresh the live tab.
