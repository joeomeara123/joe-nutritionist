---
title: Private Sites access depends on the active browser identity
category: platform-quirks
date: 2026-08-17
---

## Symptom

An owner opening a successfully deployed owner-only Site in the in-app browser sees “You don’t have access to this site.”

## Root cause

The Site access policy is custom and permits only the owner’s specific account. The in-app browser session is not necessarily authenticated as that account, even when Codex itself is running for the owner.

## Resolution options

Keep the Site private and authenticate the browser with an allowed account, add the browser account to the allowlist, or obtain explicit approval before changing the Site to public access.

## Guardrail

After a private deployment, verify the access policy and the identity used by the intended browser surface. Do not treat a successful deployment as proof that the current browser session can enter the Site.
