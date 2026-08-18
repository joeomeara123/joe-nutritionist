import { normaliseBarcode, readProduct, type ScanResult } from "@/lib/barcode";

export const runtime = "nodejs";

const ENDPOINT = "https://world.openfoodfacts.org/api/v2/product";
const FIELDS = "code,product_name,brands,quantity,serving_size,serving_quantity,nutrition_data_per,nutriments";
const TIMEOUT_MS = 12_000;
/** Barcodes are immutable, so a hit can be cached hard. A week is well inside useful. */
const CACHE_SECONDS = 604_800;

/** Same crude per-process throttle as the chat route: enough to stop a stuck client looping. */
const recent: number[] = [];
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

function rateLimited() {
  const now = Date.now();
  while (recent.length && now - recent[0] > RATE_WINDOW_MS) recent.shift();
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  return false;
}

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const barcode = normaliseBarcode(code);
  if (!barcode) {
    return Response.json({ found: false, barcode: code, reason: "invalid" } satisfies ScanResult, { status: 400 });
  }
  if (rateLimited()) {
    return Response.json({ found: false, barcode, reason: "unreachable" } satisfies ScanResult, { status: 429 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${ENDPOINT}/${barcode}.json?fields=${FIELDS}`, {
      signal: controller.signal,
      headers: { "user-agent": "joe-nutritionist/1.0 (personal nutrition tracker)" },
      next: { revalidate: CACHE_SECONDS },
    });

    // A 404 from Open Food Facts means the barcode is genuinely absent; anything else means
    // the database is having a moment. Those must not read the same — the search endpoint
    // going down and looking like "no such food" is exactly how this went wrong before.
    if (!response.ok && response.status !== 404) {
      return Response.json({ found: false, barcode, reason: "unreachable" } satisfies ScanResult, { status: 502 });
    }

    const result = readProduct(await response.json(), barcode);
    return Response.json(result, {
      headers: { "cache-control": result.found ? `public, max-age=${CACHE_SECONDS}` : "no-store" },
    });
  } catch {
    return Response.json({ found: false, barcode, reason: "unreachable" } satisfies ScanResult, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
