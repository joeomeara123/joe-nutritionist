"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ScanResult, ScannedProduct } from "@/lib/barcode";
import { aliasCollision, amountForParser, buildPantryFood, NOT_A_NAME, type PantryFood } from "@/lib/pantry";

/**
 * Scanning a barcode.
 *
 * `BarcodeDetector` is a Chromium API and Safari does not implement it, so on Joe's phone the
 * decoding is done by a WebAssembly build of ZXing loaded on demand. The native detector is
 * preferred where it exists purely to skip the download.
 *
 * Every camera failure — no permission, no camera, an insecure origin, a decoder that never
 * fires — falls through to typing the digits, which is also just faster when the packet is
 * creased. The camera is a convenience over the barcode, not the feature itself.
 */

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "itf"] as const;

type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };

async function makeDetector(): Promise<Detector> {
  const native = (window as typeof window & { BarcodeDetector?: new (options: { formats: readonly string[] }) => Detector }).BarcodeDetector;
  if (native) {
    try {
      return new native({ formats: FORMATS });
    } catch {
      // Fall through: the native detector exists but will not take these formats.
    }
  }
  const { BarcodeDetector, setZXingModuleOverrides } = await import("barcode-detector/ponyfill");
  // The .wasm is served from this app rather than a CDN, so the scanner has no third-party
  // runtime dependency. `tests/wasm-asset.test.ts` asserts the copy in public/ is current.
  setZXingModuleOverrides({ locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? "/zxing_reader.wasm" : prefix + path) });
  return new BarcodeDetector({ formats: [...FORMATS] }) as unknown as Detector;
}

type Stage = { step: "scan" } | { step: "looking"; barcode: string } | { step: "confirm"; barcode: string; result: ScanResult };

/** Empty string rather than 0, so a blank box reads as "no figure" instead of "none of it". */
type Draft = { name: string; calories: string; protein: string; carbs: string; fat: string; fibre: string; amount: string };

const MACRO_FIELDS = [
  { key: "calories", label: "kcal" },
  { key: "protein", label: "protein" },
  { key: "carbs", label: "carbs" },
  { key: "fat", label: "fat" },
  { key: "fibre", label: "fibre" },
] as const;

const draftFrom = (product?: ScannedProduct): Draft => ({
  name: (product?.name ?? "").toLowerCase().trim(),
  calories: product ? String(product.per100g.calories) : "",
  protein: product ? String(product.per100g.protein) : "",
  carbs: product ? String(product.per100g.carbs) : "",
  fat: product ? String(product.per100g.fat) : "",
  fibre: product?.per100g.fibre === null || product === undefined ? "" : String(product.per100g.fibre),
  amount: "",
});

const asNumber = (value: string): number | null => {
  const parsed = Number(value.trim());
  return value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export default function Scanner({
  pantry,
  onSave,
  onClose,
}: {
  pantry: PantryFood[];
  onSave: (entry: PantryFood, amount: string) => void;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>({ step: "scan" });
  const [draft, setDraft] = useState<Draft>(draftFrom());
  const [typed, setTyped] = useState("");
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const scanning = stage.step === "scan";

  const lookup = useCallback(async (barcode: string) => {
    setStage({ step: "looking", barcode });
    let result: ScanResult;
    try {
      const response = await fetch(`/api/barcode/${encodeURIComponent(barcode)}`);
      result = (await response.json()) as ScanResult;
    } catch {
      result = { found: false, barcode, reason: "unreachable" };
    }
    setDraft(draftFrom(result.found ? result.product : undefined));
    setStage({ step: "confirm", barcode, result });
  }, []);

  // Camera: opened while the scan step is showing, and torn down the moment it is not. A
  // camera left running behind a form is the kind of thing a phone punishes you for.
  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("This browser won't give the page a camera. Type the digits under the barcode instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const detector = await makeDetector();
        if (cancelled) return;
        timer = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const code = codes[0]?.rawValue;
            if (code) {
              clearInterval(timer);
              void lookup(code);
            }
          } catch {
            // A single failed frame is normal — the next one usually reads.
          }
        }, 250);
      } catch (caught) {
        const denied = caught instanceof DOMException && (caught.name === "NotAllowedError" || caught.name === "SecurityError");
        setCameraError(
          denied
            ? "No camera permission. Allow it in your browser settings, or just type the digits under the barcode."
            : "Couldn't start the camera. Type the digits under the barcode instead.",
        );
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [scanning, lookup]);

  const product = stage.step === "confirm" && stage.result.found ? stage.result.product : undefined;
  const clash = stage.step === "confirm" ? aliasCollision(draft.name, pantry, stage.barcode) : null;
  const numbers = MACRO_FIELDS.map((field) => asNumber(draft[field.key]));
  const [calories, protein, carbs, fat, fibre] = numbers;
  const complete = calories !== null && protein !== null && carbs !== null && fat !== null;
  const canSave = stage.step === "confirm" && !clash && complete;

  function save() {
    if (stage.step !== "confirm" || !canSave) return;
    // "Edited" means these numbers came from Joe rather than the database — either he typed
    // them all in himself, or he corrected one. That is a better source, and it is recorded
    // as such rather than being flattened into "scanned".
    const edited =
      !product ||
      MACRO_FIELDS.some((field, index) => {
        const original = product.per100g[field.key];
        return original === null ? numbers[index] !== null : numbers[index] !== original;
      });

    const entry = buildPantryFood({
      barcode: stage.barcode,
      name: draft.name,
      per100g: { calories: calories!, protein: protein!, carbs: carbs!, fat: fat!, fibre: fibre ?? 0 },
      fibreUnknown: fibre === null,
      edited,
      product,
    });
    onSave(entry, amountForParser(draft.amount));
  }

  return (
    <div className="scan-overlay" role="dialog" aria-modal="true" aria-label="Scan a barcode">
      <div className="scan-sheet">
        <header className="scan-head">
          <div>
            <p className="eyebrow">Scan</p>
            <h2>{stage.step === "confirm" ? "Check the label" : "Point at the barcode"}</h2>
          </div>
          <button type="button" className="scan-close" onClick={onClose} aria-label="Close the scanner">×</button>
        </header>

        {stage.step === "scan" && (
          <>
            {!cameraError && (
              <div className="scan-viewfinder">
                <video ref={videoRef} muted playsInline autoPlay aria-label="Camera preview" />
                <span className="scan-reticle" aria-hidden="true" />
              </div>
            )}
            {cameraError && <p className="scan-note" role="alert">{cameraError}</p>}
            <form
              className="scan-manual"
              onSubmit={(event) => {
                event.preventDefault();
                if (typed.trim()) void lookup(typed.trim());
              }}
            >
              <input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                inputMode="numeric"
                placeholder="or type the digits under the barcode"
                aria-label="Barcode digits"
              />
              <button type="submit" disabled={!typed.trim()}>Look up</button>
            </form>
          </>
        )}

        {stage.step === "looking" && <p className="scan-note">Looking up {stage.barcode}…</p>}

        {stage.step === "confirm" && (
          <div className="scan-confirm">
            {product ? (
              <div className="scan-product">
                <strong>{product.name || "Unnamed product"}</strong>
                <span>{[product.brand, product.packSize].filter(Boolean).join(" · ") || `Barcode ${stage.barcode}`}</span>
                {product.convertedFromServing && (
                  <em>The database worked this per-100g column out from a per-serving panel — worth a look.</em>
                )}
                {product.caloriesFromKilojoules && <em>Calories converted from the kilojoule figure.</em>}
              </div>
            ) : (
              <div className="scan-product missing">
                <strong>
                  {!stage.result.found && stage.result.reason === "unreachable" && "The food database isn't responding"}
                  {!stage.result.found && stage.result.reason === "invalid" && "That isn't a barcode"}
                  {!stage.result.found && (stage.result.reason === "not-in-database" || stage.result.reason === "no-nutrition") && "Not in the food database"}
                </strong>
                <span>
                  {!stage.result.found && stage.result.reason === "invalid"
                    ? "Barcodes are 8 to 13 digits. Check the number under the bars, or scan it with the camera."
                    : `Read the per-100g panel off the packet and it's saved against barcode ${stage.barcode} — you'll only ever do this once.`}
                </span>
              </div>
            )}

            <label className="scan-field">
              <span>Call it</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="what you'd type when logging it"
                aria-label="What to call this food"
              />
            </label>
            {clash && (
              <p className="scan-clash" role="alert">
                {clash === NOT_A_NAME
                  ? "Give it a name you'd actually type."
                  : `That already means “${clash}” to the app. Pick something else, or the two will shadow each other.`}
              </p>
            )}

            <fieldset className="scan-macros">
              <legend>Per 100g{product ? " — correct anything that doesn't match the packet" : ""}</legend>
              {MACRO_FIELDS.map((field) => (
                <label key={field.key}>
                  <span>{field.label}</span>
                  <input
                    value={draft[field.key]}
                    onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                    inputMode="decimal"
                    placeholder={field.key === "fibre" && product?.per100g.fibre === null ? "not published" : ""}
                    aria-label={`${field.label} per 100g`}
                  />
                </label>
              ))}
            </fieldset>
            {fibre === null && (
              <p className="scan-note small">
                No fibre figure, so it counts as 0 towards your 30g. Worth typing in if the packet gives one.
              </p>
            )}

            <label className="scan-field">
              <span>Having</span>
              <input
                value={draft.amount}
                onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
                placeholder={product?.servingGrams ? `e.g. 150g, or 1 ${product.servingLabel}` : "e.g. 150g — leave blank to just save it"}
                aria-label="How much of it you are having"
              />
            </label>

            <div className="scan-actions">
              <button type="button" className="ghost-button" onClick={() => setStage({ step: "scan" })}>Scan another</button>
              <button type="button" className="log-button" onClick={save} disabled={!canSave}>
                {draft.amount.trim() ? "Save and check it" : "Save to my foods"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
