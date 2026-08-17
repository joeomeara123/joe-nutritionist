---
title: Two reasons .env.local looks loaded but the key is missing
category: platform-quirks
date: 2026-08-17
---

## Problem

`/api/chat` returned "ANTHROPIC_API_KEY is not set" with a valid, correctly formatted
`.env.local` sitting next to `package.json`. Two independent causes, and the first masked the
second.

**1. Next inferred the wrong project root.** A stray `~/pnpm-lock.yaml` made Next walk up and
select `/Users/joe` as the root, so it looked for `.env.local` in the home directory. The tell
is the build warning "We detected multiple lockfiles and selected the directory of
/Users/joe/pnpm-lock.yaml", plus the missing `- Environments: .env.local` line at startup.

**2. An empty environment variable shadowed the file.** `ANTHROPIC_API_KEY` was exported as
an empty string in the shell. dotenv does not override a variable that is already defined, so
the file was parsed, the key was skipped, and startup still printed
`- Environments: .env.local` — the file genuinely loaded, just not that key.

The second one is nasty because `[ -n "$ANTHROPIC_API_KEY" ]` reports "not set" while dotenv
treats it as very much set.

## Fix

Pin the root in `next.config.ts`:

```ts
const projectRoot = dirname(fileURLToPath(import.meta.url));
export default { outputFileTracingRoot: projectRoot, turbopack: { root: projectRoot } };
```

For the empty variable, unset it for the process rather than assigning over it:

```bash
env -u ANTHROPIC_API_KEY npm run start
```

Neither affects Vercel, where env vars arrive as real process env and no file is read.

## Guardrail

Diagnose in this order, it takes seconds:
1. `env | grep '^ANTHROPIC_API_KEY='` — present but empty is the trap.
2. Startup log for `- Environments: .env.local` — absent means the root is wrong.
3. Run once with the value inline (`ANTHROPIC_API_KEY=probe npx next start`); a real 401 from
   the API proves the route works and isolates the fault to env loading.
