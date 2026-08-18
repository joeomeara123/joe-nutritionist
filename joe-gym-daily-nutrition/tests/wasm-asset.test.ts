import { describe, expect, test } from "bun:test";

/**
 * The barcode decoder's WebAssembly is served from this app rather than a CDN, so the scanner
 * has no third-party runtime dependency. That means a copy of it lives in public/, and a copy
 * goes stale silently: the page would load a decoder built against a different version of the
 * JavaScript that drives it. This asserts the two are the same bytes.
 *
 * If it fails, refresh the copy:
 *   cp node_modules/zxing-wasm/dist/reader/zxing_reader.wasm public/zxing_reader.wasm
 */
describe("the barcode decoder's WebAssembly", () => {
  test("matches the version the package expects", async () => {
    const served = Bun.file("public/zxing_reader.wasm");
    const packaged = Bun.file("node_modules/zxing-wasm/dist/reader/zxing_reader.wasm");

    expect(await served.exists()).toBe(true);
    expect(await packaged.exists()).toBe(true);
    expect(Bun.SHA256.hash(await served.arrayBuffer(), "hex")).toBe(Bun.SHA256.hash(await packaged.arrayBuffer(), "hex"));
  });
});
