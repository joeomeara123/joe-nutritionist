import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders Joe's nutrition dashboard shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Joe(?:'|&#x27;)s Daily Nutrition<\/title>/i);
  assert.match(html, /Loading Joe/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("keeps Joe's targets and current Veetee pot values exact", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /calories:\s*1800,\s*protein:\s*160,\s*carbs:\s*155,\s*fat:\s*60,\s*fibre:\s*30/);
  assert.match(page, /portionGrams:\s*130[\s\S]*?calories:\s*198,\s*protein:\s*3,\s*carbs:\s*41\.2,\s*fat:\s*2\.3/);
  assert.match(page, /scaled\(FOODS\[0\],\s*192\)/);
  assert.match(page, /scaled\(FOODS\[4\],\s*130\)/);
});
