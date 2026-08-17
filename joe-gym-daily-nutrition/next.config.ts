import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

// Pin the project root. Without this, Next walks up looking for a lockfile, finds the stray
// ~/pnpm-lock.yaml and decides the root is /Users/joe — which means it loads .env.local from
// the home directory and the app starts with no ANTHROPIC_API_KEY.
const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  turbopack: { root: projectRoot },
};

export default nextConfig;
